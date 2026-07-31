
-- =========================================
-- Bella IA Core — Sprint 14
-- =========================================

-- Conversations
CREATE TABLE public.assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  provider TEXT NOT NULL DEFAULT 'openai' CHECK (provider IN ('openai','anthropic','gemini','deepseek')),
  model TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assistant_conversations_company ON public.assistant_conversations(company_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_conversations TO authenticated;
GRANT ALL ON public.assistant_conversations TO service_role;
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage conversations" ON public.assistant_conversations
  FOR ALL USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER trg_assistant_conversations_updated_at
  BEFORE UPDATE ON public.assistant_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Messages
CREATE TABLE public.assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content TEXT NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  provider TEXT,
  model TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assistant_messages_conversation ON public.assistant_messages(conversation_id, created_at);
CREATE INDEX idx_assistant_messages_company ON public.assistant_messages(company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_messages TO service_role;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage messages" ON public.assistant_messages
  FOR ALL USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));

-- Context snapshots
CREATE TABLE public.assistant_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL CHECK (context_type IN (
    'products','purchases','inventory','customers','crm','sales','finance','agenda','marketing','reports','global'
  )),
  scope TEXT,
  reference_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assistant_context_company_type ON public.assistant_context(company_id, context_type, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_context TO authenticated;
GRANT ALL ON public.assistant_context TO service_role;
ALTER TABLE public.assistant_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage context" ON public.assistant_context
  FOR ALL USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER trg_assistant_context_updated_at
  BEFORE UPDATE ON public.assistant_context
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recommendations
CREATE TABLE public.assistant_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'finance','sales','customers','products','marketing','agenda','inventory','general'
  )),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed','done')),
  target_module TEXT,
  target_id UUID,
  action_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assistant_recommendations_company ON public.assistant_recommendations(company_id, status, priority);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_recommendations TO authenticated;
GRANT ALL ON public.assistant_recommendations TO service_role;
ALTER TABLE public.assistant_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage recommendations" ON public.assistant_recommendations
  FOR ALL USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER trg_assistant_recommendations_updated_at
  BEFORE UPDATE ON public.assistant_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Alerts
CREATE TABLE public.assistant_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'low_stock','inactive_customer','negative_cashflow','sale_above_average',
    'purchase_out_of_pattern','overdue_payment','important_appointment','custom'
  )),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  title TEXT NOT NULL,
  message TEXT,
  entity_type TEXT,
  entity_id UUID,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','snoozed')),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assistant_alerts_company ON public.assistant_alerts(company_id, status, severity, triggered_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_alerts TO authenticated;
GRANT ALL ON public.assistant_alerts TO service_role;
ALTER TABLE public.assistant_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage alerts" ON public.assistant_alerts
  FOR ALL USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER trg_assistant_alerts_updated_at
  BEFORE UPDATE ON public.assistant_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
