ALTER TABLE public.fiscal_secrets DROP CONSTRAINT IF EXISTS fiscal_secrets_kind_check;
ALTER TABLE public.fiscal_secrets ADD CONSTRAINT fiscal_secrets_kind_check
  CHECK (kind = ANY (ARRAY['cert_password'::text, 'provider_api_key'::text, 'provider_admin_key'::text, 'csc_token'::text]));