
-- Extend fiscal_settings
ALTER TABLE public.fiscal_settings
  ADD COLUMN IF NOT EXISTS annual_revenue_limit numeric(15,2),
  ADD COLUMN IF NOT EXISTS fiscal_year_start_month integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS alert_thresholds jsonb NOT NULL DEFAULT '[70,80,90,95,100]'::jsonb;

ALTER TABLE public.fiscal_settings
  DROP CONSTRAINT IF EXISTS fiscal_settings_fiscal_year_start_month_chk;
ALTER TABLE public.fiscal_settings
  ADD CONSTRAINT fiscal_settings_fiscal_year_start_month_chk
  CHECK (fiscal_year_start_month BETWEEN 1 AND 12);

-- Snapshots table
CREATE TABLE IF NOT EXISTS public.fiscal_health_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  snapshot_month date NOT NULL,
  tax_regime text NOT NULL,
  annual_limit numeric(15,2),
  ytd_revenue numeric(15,2) NOT NULL DEFAULT 0,
  monthly_revenue numeric(15,2) NOT NULL DEFAULT 0,
  percent_used numeric(6,2),
  status text NOT NULL DEFAULT 'green',
  projection_year_end numeric(15,2),
  months_elapsed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, snapshot_month),
  CHECK (status IN ('green','yellow','orange','red','unknown'))
);

CREATE INDEX IF NOT EXISTS idx_fiscal_health_snapshots_company_month
  ON public.fiscal_health_snapshots (company_id, snapshot_month DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_health_snapshots TO authenticated;
GRANT ALL ON public.fiscal_health_snapshots TO service_role;

ALTER TABLE public.fiscal_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_health_select"
  ON public.fiscal_health_snapshots FOR SELECT
  TO authenticated
  USING (
    public.user_has_company_access(company_id)
    AND public.has_permission(auth.uid(), company_id, 'fiscal.view')
  );

CREATE POLICY "fiscal_health_insert"
  ON public.fiscal_health_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_company_access(company_id)
    AND public.has_permission(auth.uid(), company_id, 'fiscal.manage')
  );

CREATE POLICY "fiscal_health_update"
  ON public.fiscal_health_snapshots FOR UPDATE
  TO authenticated
  USING (
    public.user_has_company_access(company_id)
    AND public.has_permission(auth.uid(), company_id, 'fiscal.manage')
  )
  WITH CHECK (
    public.user_has_company_access(company_id)
    AND public.has_permission(auth.uid(), company_id, 'fiscal.manage')
  );

CREATE POLICY "fiscal_health_delete"
  ON public.fiscal_health_snapshots FOR DELETE
  TO authenticated
  USING (
    public.user_has_company_access(company_id)
    AND public.has_permission(auth.uid(), company_id, 'fiscal.manage')
  );
