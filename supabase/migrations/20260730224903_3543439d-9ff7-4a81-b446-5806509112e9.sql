-- ============================================================
-- Fiscal: credenciais por AMBIENTE no cofre (fiscal_secrets)
-- Homologação e Produção passam a coexistir sem colisão de unicidade.
-- Nenhuma regra fiscal / lógica de emissão é alterada.
-- ============================================================

-- 1) Backfill seguro: segredos do provedor sem ambiente pertencem à Produção
--    (era o único ambiente possível antes desta arquitetura).
UPDATE public.fiscal_secrets
   SET environment = 'production'
 WHERE kind IN ('provider_api_key', 'provider_admin_key')
   AND environment IS NULL;

-- 2) Dedupe defensivo na NOVA chave lógica (company, kind, owner, environment):
--    mantém apenas o registro mais recente de cada combinação.
DELETE FROM public.fiscal_secrets s
USING public.fiscal_secrets s2
WHERE s.company_id = s2.company_id
  AND s.kind = s2.kind
  AND s.owner_id IS NOT DISTINCT FROM s2.owner_id
  AND s.environment IS NOT DISTINCT FROM s2.environment
  AND (s.updated_at, s.id) < (s2.updated_at, s2.id);

-- 3) Nova unicidade incluindo o ambiente. NULLS NOT DISTINCT mantém o
--    comportamento para segredos sem ambiente (cert_password, csc_token).
DROP INDEX IF EXISTS public.fiscal_secrets_company_kind_owner_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS fiscal_secrets_company_kind_owner_env_uidx
  ON public.fiscal_secrets (company_id, kind, owner_id, environment) NULLS NOT DISTINCT;

-- 4) Gravação: apaga/insere apenas o registro do ambiente solicitado.
--    (idempotente; mesma assinatura já usada pela aplicação)
CREATE OR REPLACE FUNCTION public.fiscal_set_secret(
  _company_id uuid,
  _kind text,
  _owner_id uuid,
  _ciphertext bytea,
  _environment text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.has_permission(_uid, _company_id, 'fiscal.manage') THEN
    RAISE EXCEPTION 'forbidden: fiscal.manage required';
  END IF;
  IF _environment IS NOT NULL AND _environment NOT IN ('homologation','production') THEN
    RAISE EXCEPTION 'invalid environment: %', _environment;
  END IF;
  -- Credenciais de provedor SEMPRE pertencem a um ambiente.
  IF _kind IN ('provider_api_key','provider_admin_key') AND _environment IS NULL THEN
    RAISE EXCEPTION 'environment required for %', _kind;
  END IF;

  DELETE FROM public.fiscal_secrets
   WHERE company_id = _company_id
     AND kind = _kind
     AND (owner_id IS NOT DISTINCT FROM _owner_id)
     AND (environment IS NOT DISTINCT FROM _environment);

  IF _ciphertext IS NULL OR octet_length(_ciphertext) = 0 THEN
    RETURN;  -- exclusão do segredo daquele ambiente
  END IF;

  INSERT INTO public.fiscal_secrets (company_id, kind, owner_id, ciphertext, updated_by, environment)
  VALUES (_company_id, _kind, _owner_id, _ciphertext, _uid, _environment);
END;
$function$;

REVOKE ALL ON FUNCTION public.fiscal_set_secret(uuid, text, uuid, bytea, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fiscal_set_secret(uuid, text, uuid, bytea, text) TO authenticated;

-- 5) Leitura de existência: estritamente por ambiente quando informado.
CREATE OR REPLACE FUNCTION public.fiscal_has_secret(
  _company_id uuid,
  _kind text,
  _owner_id uuid,
  _environment text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT public.has_permission(_uid, _company_id, 'fiscal.view') THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.fiscal_secrets
     WHERE company_id = _company_id
       AND kind = _kind
       AND (owner_id IS NOT DISTINCT FROM _owner_id)
       AND (_environment IS NULL OR environment IS NOT DISTINCT FROM _environment)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fiscal_has_secret(uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fiscal_has_secret(uuid, text, uuid, text) TO authenticated;