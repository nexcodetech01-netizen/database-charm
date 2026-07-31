
CREATE TABLE public.nexos_event_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  module TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  source TEXT,
  dedupe_key TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT nexos_event_log_status_chk CHECK (status IN ('pending','processing','success','error','skipped')),
  CONSTRAINT nexos_event_log_priority_chk CHECK (priority IN ('LOW','NORMAL','HIGH','CRITICAL'))
);

CREATE UNIQUE INDEX nexos_event_log_dedupe_idx
  ON public.nexos_event_log (company_id, type, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE INDEX nexos_event_log_company_created_idx
  ON public.nexos_event_log (company_id, created_at DESC);
CREATE INDEX nexos_event_log_status_idx
  ON public.nexos_event_log (company_id, status);

GRANT SELECT, INSERT, UPDATE ON public.nexos_event_log TO authenticated;
GRANT ALL ON public.nexos_event_log TO service_role;

ALTER TABLE public.nexos_event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own company events"
  ON public.nexos_event_log FOR SELECT TO authenticated
  USING (company_id = (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users insert own company events"
  ON public.nexos_event_log FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users update own company events"
  ON public.nexos_event_log FOR UPDATE TO authenticated
  USING (company_id = (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));

CREATE TRIGGER nexos_event_log_updated_at
  BEFORE UPDATE ON public.nexos_event_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
