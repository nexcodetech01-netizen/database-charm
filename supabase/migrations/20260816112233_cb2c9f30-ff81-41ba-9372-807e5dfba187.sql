ALTER TABLE public.whatsapp_commercial_inbox ADD COLUMN IF NOT EXISTS notification_id TEXT UNIQUE;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_commercial_inbox TO authenticated;
GRANT ALL ON public.whatsapp_commercial_inbox TO service_role;