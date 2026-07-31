
-- 1) Mapeamento phone_number_id → company (multi-tenant)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text;

CREATE UNIQUE INDEX IF NOT EXISTS companies_whatsapp_phone_number_id_key
  ON public.companies (whatsapp_phone_number_id)
  WHERE whatsapp_phone_number_id IS NOT NULL;

-- 2) Contatos do WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  wa_id text NOT NULL,
  phone text,
  profile_name text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, wa_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_contacts TO authenticated;
GRANT ALL ON public.whatsapp_contacts TO service_role;

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_contacts company access"
  ON public.whatsapp_contacts FOR ALL
  TO authenticated
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

CREATE TRIGGER whatsapp_contacts_set_updated_at
  BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Conversas (uma por contato)
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  bella_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, contact_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_conversations company access"
  ON public.whatsapp_conversations FOR ALL
  TO authenticated
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

CREATE TRIGGER whatsapp_conversations_set_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Mensagens (inbound e outbound)
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  wa_message_id text,
  text text,
  payload jsonb,
  status text,
  error text,
  processing_ms integer,
  provider text,
  skill_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, wa_message_id)
);

CREATE INDEX IF NOT EXISTS whatsapp_messages_conversation_created_idx
  ON public.whatsapp_messages (conversation_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_messages company access"
  ON public.whatsapp_messages FOR ALL
  TO authenticated
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));
