
-- ============================================================
-- Sprint 007.2.1 — Fiscal readiness
-- ============================================================

-- Ensure pgcrypto is available for pgp_sym_encrypt/decrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ------------------------------------------------------------
-- fiscal_settings (1 per company)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiscal_settings (
  company_id           uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  tax_regime           text NOT NULL DEFAULT 'simples'
                        CHECK (tax_regime IN ('simples','presumido','real','mei')),
  emit_uf              text NOT NULL DEFAULT 'SP'
                        CHECK (char_length(emit_uf) = 2),
  nfe_series           integer NOT NULL DEFAULT 1 CHECK (nfe_series > 0),
  nfe_next_number      integer NOT NULL DEFAULT 1 CHECK (nfe_next_number > 0),
  default_environment  text NOT NULL DEFAULT 'homologation'
                        CHECK (default_environment IN ('homologation','production')),
  operation_nature     text NOT NULL DEFAULT 'Venda de mercadoria adquirida ou recebida de terceiros',
  default_cfop         text NOT NULL DEFAULT '5102' CHECK (char_length(default_cfop) = 4),
  default_ncm          text NOT NULL DEFAULT '00000000' CHECK (char_length(default_ncm) BETWEEN 2 AND 8),
  csc_id               text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE ON public.fiscal_settings TO authenticated;
GRANT ALL ON public.fiscal_settings TO service_role;

ALTER TABLE public.fiscal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_settings_select" ON public.fiscal_settings
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), company_id, 'fiscal.view'));

CREATE POLICY "fiscal_settings_insert" ON public.fiscal_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), company_id, 'fiscal.manage')
  );

CREATE POLICY "fiscal_settings_update" ON public.fiscal_settings
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), company_id, 'fiscal.manage')
  )
  WITH CHECK (
    public.has_permission(auth.uid(), company_id, 'fiscal.manage')
  );

CREATE TRIGGER trg_fiscal_settings_touch
  BEFORE UPDATE ON public.fiscal_settings
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- ------------------------------------------------------------
-- fiscal_secrets (encrypted vault, no direct SELECT to authenticated)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiscal_secrets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('cert_password','provider_api_key','csc_token')),
  owner_id     uuid,   -- e.g. fiscal_certificates.id; NULL when singleton (provider api key)
  ciphertext   bytea NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES auth.users(id),
  UNIQUE (company_id, kind, owner_id)
);

-- Only service_role has any direct access.
GRANT ALL ON public.fiscal_secrets TO service_role;
ALTER TABLE public.fiscal_secrets ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated → RLS denies all direct access.

-- ------------------------------------------------------------
-- Extend fiscal_provider_config
-- ------------------------------------------------------------
ALTER TABLE public.fiscal_provider_config
  ADD COLUMN IF NOT EXISTS api_url                text,
  ADD COLUMN IF NOT EXISTS notes                  text,
  ADD COLUMN IF NOT EXISTS webhook_url            text,
  ADD COLUMN IF NOT EXISTS last_health_check_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_health_status     text CHECK (last_health_status IN ('ok','warning','error')),
  ADD COLUMN IF NOT EXISTS last_health_message    text;

-- ------------------------------------------------------------
-- Helper: encryption/decryption using GUC-provided key
--   caller must SET LOCAL app.fiscal_secrets_key = '<hex>' first
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._fiscal_secrets_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  k text;
BEGIN
  k := current_setting('app.fiscal_secrets_key', true);
  IF k IS NULL OR k = '' THEN
    RAISE EXCEPTION 'fiscal secrets key not configured';
  END IF;
  RETURN k;
END;
$$;

-- ------------------------------------------------------------
-- RPC: set / clear fiscal secret
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fiscal_set_secret(
  _company_id uuid,
  _kind text,
  _owner_id uuid,
  _plaintext text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.has_permission(_uid, _company_id, 'fiscal.manage') THEN
    RAISE EXCEPTION 'forbidden: fiscal.manage required';
  END IF;

  IF _plaintext IS NULL OR length(_plaintext) = 0 THEN
    DELETE FROM public.fiscal_secrets
     WHERE company_id = _company_id
       AND kind = _kind
       AND (owner_id IS NOT DISTINCT FROM _owner_id);
    RETURN;
  END IF;

  INSERT INTO public.fiscal_secrets (company_id, kind, owner_id, ciphertext, updated_by)
  VALUES (
    _company_id, _kind, _owner_id,
    extensions.pgp_sym_encrypt(_plaintext, public._fiscal_secrets_key()),
    _uid
  )
  ON CONFLICT (company_id, kind, owner_id) DO UPDATE
    SET ciphertext = EXCLUDED.ciphertext,
        updated_at = now(),
        updated_by = _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.fiscal_set_secret(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fiscal_set_secret(uuid, text, uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- RPC: check whether a secret is configured (returns boolean)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fiscal_has_secret(
  _company_id uuid,
  _kind text,
  _owner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
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
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fiscal_has_secret(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fiscal_has_secret(uuid, text, uuid) TO authenticated;

-- ------------------------------------------------------------
-- RPC: delete certificate (only when inactive)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fiscal_delete_certificate(_certificate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cert public.fiscal_certificates%ROWTYPE;
  _uid uuid := auth.uid();
BEGIN
  SELECT * INTO _cert FROM public.fiscal_certificates WHERE id = _certificate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'certificate not found';
  END IF;
  IF NOT public.has_permission(_uid, _cert.company_id, 'fiscal.manage') THEN
    RAISE EXCEPTION 'forbidden: fiscal.manage required';
  END IF;
  IF _cert.is_active THEN
    RAISE EXCEPTION 'cannot delete active certificate: deactivate first';
  END IF;

  DELETE FROM public.fiscal_secrets
   WHERE company_id = _cert.company_id
     AND kind = 'cert_password'
     AND owner_id = _cert.id;

  DELETE FROM public.fiscal_certificates WHERE id = _cert.id;
END;
$$;

REVOKE ALL ON FUNCTION public.fiscal_delete_certificate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fiscal_delete_certificate(uuid) TO authenticated;

-- ------------------------------------------------------------
-- RPC: record provider health check outcome
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fiscal_record_provider_health(
  _company_id uuid,
  _status text,
  _message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT public.has_permission(_uid, _company_id, 'fiscal.manage') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('ok','warning','error') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  UPDATE public.fiscal_provider_config
     SET last_health_check_at = now(),
         last_health_status   = _status,
         last_health_message  = _message,
         updated_at           = now(),
         updated_by           = _uid
   WHERE company_id = _company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fiscal_record_provider_health(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fiscal_record_provider_health(uuid, text, text) TO authenticated;
