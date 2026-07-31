CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature TEXT,
  payload JSONB,
  raw_body TEXT,
  processing_error TEXT
);
GRANT ALL ON public.whatsapp_webhook_logs TO service_role;
ALTER TABLE public.whatsapp_webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_logs_received_at
  ON public.whatsapp_webhook_logs (received_at DESC);