ALTER TABLE public.whatsapp_commercial_inbox 
ADD COLUMN IF NOT EXISTS change_needed boolean,
ADD COLUMN IF NOT EXISTS change_amount numeric;

GRANT ALL ON public.whatsapp_commercial_inbox TO authenticated, service_role;
