ALTER TABLE public.fiscal_provider_config
  ADD COLUMN IF NOT EXISTS provisioned_at timestamptz,
  ADD COLUMN IF NOT EXISTS provisioned_environment text,
  ADD COLUMN IF NOT EXISTS provisioned_certificate_id uuid,
  ADD COLUMN IF NOT EXISTS provisioned_by uuid,
  ADD COLUMN IF NOT EXISTS provisioned_note text;