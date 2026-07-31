
CREATE TABLE public.bella_pay_api_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox','production')),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  status INTEGER,
  duration_ms INTEGER,
  error_message TEXT,
  error_body JSONB,
  correlation_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bella_pay_api_metrics_company_time
  ON public.bella_pay_api_metrics(company_id, created_at DESC);
CREATE INDEX idx_bella_pay_api_metrics_failures
  ON public.bella_pay_api_metrics(company_id, environment, endpoint, created_at DESC)
  WHERE ok = false;

GRANT SELECT, INSERT ON public.bella_pay_api_metrics TO authenticated;
GRANT ALL ON public.bella_pay_api_metrics TO service_role;

ALTER TABLE public.bella_pay_api_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members read own metrics" ON public.bella_pay_api_metrics
  FOR SELECT USING (public.user_owns_company(company_id));

CREATE POLICY "Company members insert own metrics" ON public.bella_pay_api_metrics
  FOR INSERT WITH CHECK (public.user_owns_company(company_id));
