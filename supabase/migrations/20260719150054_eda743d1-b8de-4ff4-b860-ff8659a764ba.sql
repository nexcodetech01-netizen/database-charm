
-- 1) Nova função: acesso à empresa = owner OU membro via user_roles
CREATE OR REPLACE FUNCTION public.user_has_company_access(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.companies
      WHERE id = _company_id AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND company_id = _company_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_company_access(uuid) TO authenticated, service_role;

-- 2) Reapontar todas as policies que usam user_owns_company(...)
-- Recria cada policy substituindo textualmente a chamada da função em qual e with_check.
DO $mig$
DECLARE
  pol RECORD;
  new_qual TEXT;
  new_check TEXT;
  cmd_sql TEXT;
  roles_sql TEXT;
  cmd_kw TEXT;
BEGIN
  FOR pol IN
    SELECT n.nspname     AS schema_name,
           c.relname     AS table_name,
           p.polname     AS policy_name,
           p.polcmd      AS cmd,
           p.polpermissive AS permissive,
           pg_get_expr(p.polqual,  p.polrelid) AS qual_expr,
           pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr,
           (SELECT array_agg(rolname ORDER BY rolname)
              FROM pg_roles r
             WHERE r.oid = ANY(p.polroles)) AS roles
      FROM pg_policy p
      JOIN pg_class c  ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE COALESCE(pg_get_expr(p.polqual, p.polrelid), '') LIKE '%user_owns_company(%'
        OR COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '') LIKE '%user_owns_company(%'
  LOOP
    new_qual  := replace(COALESCE(pol.qual_expr, ''),  'user_owns_company(', 'user_has_company_access(');
    new_check := replace(COALESCE(pol.check_expr, ''), 'user_owns_company(', 'user_has_company_access(');

    cmd_kw := CASE pol.cmd
                WHEN 'r' THEN 'SELECT'
                WHEN 'a' THEN 'INSERT'
                WHEN 'w' THEN 'UPDATE'
                WHEN 'd' THEN 'DELETE'
                WHEN '*' THEN 'ALL'
              END;

    IF pol.roles IS NULL OR array_length(pol.roles, 1) IS NULL THEN
      roles_sql := 'PUBLIC';
    ELSE
      roles_sql := array_to_string(ARRAY(SELECT quote_ident(x) FROM unnest(pol.roles) x), ', ');
    END IF;

    EXECUTE format('DROP POLICY %I ON %I.%I',
                   pol.policy_name, pol.schema_name, pol.table_name);

    cmd_sql := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      pol.policy_name, pol.schema_name, pol.table_name,
      CASE WHEN pol.permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      cmd_kw, roles_sql
    );

    IF pol.qual_expr IS NOT NULL THEN
      cmd_sql := cmd_sql || ' USING (' || new_qual || ')';
    END IF;
    IF pol.check_expr IS NOT NULL THEN
      cmd_sql := cmd_sql || ' WITH CHECK (' || new_check || ')';
    END IF;

    EXECUTE cmd_sql;
  END LOOP;
END
$mig$;
