ALTER TABLE public.bella_pay_charges
  ADD COLUMN IF NOT EXISTS pix_expires_at TIMESTAMPTZ;

ALTER TABLE public.bella_pay_webhook_events
  ADD COLUMN IF NOT EXISTS transition_rejected BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS value_mismatch BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warnings JSONB;