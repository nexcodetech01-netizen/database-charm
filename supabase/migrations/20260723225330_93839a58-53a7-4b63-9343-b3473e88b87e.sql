
-- Bella Automations: modelos + execuções, com RLS multi-tenant.
CREATE TABLE public.bella_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  template_id text,
  last_run_at timestamptz,
  last_run_status text,
  next_run_at timestamptz,
  run_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bella_automations_company_trigger_idx
  ON public.bella_automations (company_id, trigger_type) WHERE enabled = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bella_automations TO authenticated;
GRANT ALL ON public.bella_automations TO service_role;
ALTER TABLE public.bella_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Automations: tenant read"
  ON public.bella_automations FOR SELECT TO authenticated
  USING (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Automations: tenant insert"
  ON public.bella_automations FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Automations: tenant update"
  ON public.bella_automations FOR UPDATE TO authenticated
  USING (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Automations: tenant delete"
  ON public.bella_automations FOR DELETE TO authenticated
  USING (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));

-- Execuções / logs
CREATE TABLE public.bella_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.bella_automations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  trigger_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL,           -- success | error | skipped | partial
  duration_ms integer,
  actions_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bella_automation_runs_company_created_idx
  ON public.bella_automation_runs (company_id, created_at DESC);
CREATE INDEX bella_automation_runs_automation_created_idx
  ON public.bella_automation_runs (automation_id, created_at DESC);

GRANT SELECT ON public.bella_automation_runs TO authenticated;
GRANT ALL ON public.bella_automation_runs TO service_role;
ALTER TABLE public.bella_automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Automation runs: tenant read"
  ON public.bella_automation_runs FOR SELECT TO authenticated
  USING (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));

-- Trigger updated_at (reutiliza função existente se presente)
CREATE OR REPLACE FUNCTION public.bella_automations_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER bella_automations_updated_at
  BEFORE UPDATE ON public.bella_automations
  FOR EACH ROW EXECUTE FUNCTION public.bella_automations_touch_updated_at();
