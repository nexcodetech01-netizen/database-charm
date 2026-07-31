-- Blindar user_roles: somente owner da empresa pode INSERT/UPDATE/DELETE.
-- SELECT preservado.

DROP POLICY IF EXISTS user_roles_insert_owner ON public.user_roles;
DROP POLICY IF EXISTS user_roles_update_owner ON public.user_roles;
DROP POLICY IF EXISTS user_roles_delete_owner ON public.user_roles;

CREATE POLICY user_roles_insert_owner
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = user_roles.company_id
      AND c.owner_id = auth.uid()
  )
);

CREATE POLICY user_roles_update_owner
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = user_roles.company_id
      AND c.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = user_roles.company_id
      AND c.owner_id = auth.uid()
  )
);

CREATE POLICY user_roles_delete_owner
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = user_roles.company_id
      AND c.owner_id = auth.uid()
  )
);