-- ============================================================
-- Fiscal: suporte nativo a Produção + Homologação (Focus NFe)
-- ============================================================

-- 1) Ambiente no vault de segredos ---------------------------
ALTER TABLE public.fiscal_secrets ADD COLUMN IF NOT EXISTS environment text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fiscal_secrets_environment_check'
  ) THEN
    ALTER TABLE public.fiscal_secrets
      ADD CONSTRAINT fiscal_secrets_environment_check
      CHECK (environment IS NULL OR environment IN ('homologation','production'));
  END IF;
END $$;

-- Compatibilidade: a chave existente pertence ao ambiente já provisionado/
-- configurado da empresa; sem informação, considera-se produção.
UPDATE public.fiscal_secrets s
   SET environment = COALESCE(c.provisioned_environment, c.environment, 'production')
  FROM public.fiscal_provider_config c
 WHERE c.company_id = s.company_id
   AND s.kind = 'provider_api_key'
   AND s.environment IS NULL;

UPDATE public.fiscal_secrets
   SET environment = 'production'
 WHERE kind = 'provider_api_key' AND environment IS NULL;

CREATE INDEX IF NOT EXISTS idx_fiscal_secrets_company_kind_env
  ON public.fiscal_secrets (company_id, kind, environment);

-- 2) Configuração do provedor por ambiente -------------------
CREATE TABLE IF NOT EXISTS public.fiscal_provider_environments (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('homologation','production')),
  api_url text,
  provisioned_at timestamptz,
  provisioned_environment text CHECK (provisioned_environment IS NULL OR provisioned_environment IN ('homologation','production')),
  provisioned_certificate_id uuid,
  provisioned_by uuid,
  provisioned_note text,
  last_health_check_at timestamptz,
  last_health_status text CHECK (last_health_status IS NULL OR last_health_status IN ('ok','warning','error')),
  last_health_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (company_id, environment)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_provider_environments TO authenticated;
GRANT ALL ON public.fiscal_provider_environments TO service_role;

ALTER TABLE public.fiscal_provider_environments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiscal_provider_environments_select ON public.fiscal_provider_environments;
CREATE POLICY fiscal_provider_environments_select
  ON public.fiscal_provider_environments FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), company_id, 'fiscal.view'));

DROP POLICY IF EXISTS fiscal_provider_environments_write ON public.fiscal_provider_environments;
CREATE POLICY fiscal_provider_environments_write
  ON public.fiscal_provider_environments FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), company_id, 'fiscal.manage'))
  WITH CHECK (public.has_permission(auth.uid(), company_id, 'fiscal.manage'));

DROP TRIGGER IF EXISTS trg_fiscal_provider_environments_touch ON public.fiscal_provider_environments;
CREATE TRIGGER trg_fiscal_provider_environments_touch
  BEFORE UPDATE ON public.fiscal_provider_environments
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- Backfill: ambiente atual recebe os dados legados
INSERT INTO public.fiscal_provider_environments (
  company_id, environment, api_url, provisioned_at, provisioned_environment,
  provisioned_certificate_id, provisioned_by, provisioned_note,
  last_health_check_at, last_health_status, last_health_message, updated_by
)
SELECT c.company_id,
       COALESCE(c.provisioned_environment, c.environment, 'production'),
       c.api_url, c.provisioned_at, c.provisioned_environment,
       c.provisioned_certificate_id, c.provisioned_by, c.provisioned_note,
       c.last_health_check_at, c.last_health_status, c.last_health_message, c.updated_by
  FROM public.fiscal_provider_config c
ON CONFLICT (company_id, environment) DO NOTHING;

-- Backfill: linha vazia para o ambiente complementar
INSERT INTO public.fiscal_provider_environments (company_id, environment)
SELECT c.company_id,
       CASE WHEN COALESCE(c.provisioned_environment, c.environment, 'production') = 'production'
            THEN 'homologation' ELSE 'production' END
  FROM public.fiscal_provider_config c
ON CONFLICT (company_id, environment) DO NOTHING;

-- 3) RPCs de segredo cientes de ambiente ---------------------
DROP FUNCTION IF EXISTS public.fiscal_has_secret(uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.fiscal_has_secret(
  _company_id uuid, _kind text, _owner_id uuid, _environment text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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

DROP FUNCTION IF EXISTS public.fiscal_set_secret(uuid, text, uuid, bytea);
CREATE OR REPLACE FUNCTION public.fiscal_set_secret(
  _company_id uuid, _kind text, _owner_id uuid, _ciphertext bytea, _environment text DEFAULT NULL
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

  DELETE FROM public.fiscal_secrets
   WHERE company_id = _company_id
     AND kind = _kind
     AND (owner_id IS NOT DISTINCT FROM _owner_id)
     AND (environment IS NOT DISTINCT FROM _environment);

  IF _ciphertext IS NULL OR octet_length(_ciphertext) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.fiscal_secrets (company_id, kind, owner_id, ciphertext, updated_by, environment)
  VALUES (_company_id, _kind, _owner_id, _ciphertext, _uid, _environment);
END;
$function$;