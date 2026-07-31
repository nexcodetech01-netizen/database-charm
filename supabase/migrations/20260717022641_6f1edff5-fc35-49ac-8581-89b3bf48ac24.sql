
CREATE TABLE public.whatsapp_message_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound')),
  wa_message_id TEXT,
  status TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_msg_events_company_sent ON public.whatsapp_message_events (company_id, sent_at DESC);

GRANT SELECT, INSERT ON public.whatsapp_message_events TO authenticated;
GRANT ALL ON public.whatsapp_message_events TO service_role;

ALTER TABLE public.whatsapp_message_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view WA message events"
  ON public.whatsapp_message_events FOR SELECT
  TO authenticated
  USING (public.user_owns_company(company_id));

CREATE POLICY "Company members can insert WA message events"
  ON public.whatsapp_message_events FOR INSERT
  TO authenticated
  WITH CHECK (public.user_owns_company(company_id));
