
CREATE TABLE public.bella_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id UUID,
  intent TEXT,
  skill_id TEXT,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirmation_required BOOLEAN NOT NULL DEFAULT false,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  success BOOLEAN NOT NULL DEFAULT false,
  result_code TEXT,
  error_message TEXT,
  execution_time_ms INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bella_executions_company_started
  ON public.bella_executions (company_id, started_at DESC);
CREATE INDEX idx_bella_executions_skill
  ON public.bella_executions (company_id, skill_id);
CREATE INDEX idx_bella_executions_intent
  ON public.bella_executions (company_id, intent);

GRANT SELECT, INSERT ON public.bella_executions TO authenticated;
GRANT ALL ON public.bella_executions TO service_role;

ALTER TABLE public.bella_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bella_executions_select_company_member"
  ON public.bella_executions FOR SELECT
  TO authenticated
  USING (public.user_has_company_access(company_id));

CREATE POLICY "bella_executions_insert_self"
  ON public.bella_executions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_company_access(company_id)
    AND (user_id IS NULL OR user_id = auth.uid())
  );
