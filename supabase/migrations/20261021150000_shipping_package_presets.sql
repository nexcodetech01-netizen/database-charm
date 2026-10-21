-- Pacotes salvos da calculadora de frete (21/10/2026).
-- Um clique preenche formato, peso e medidas (ex.: "Envelope camiseta").
CREATE TABLE IF NOT EXISTS public.shipping_package_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  format text NOT NULL DEFAULT '1' CHECK (format IN ('1', '2', '3')),
  weight_kg numeric(8,3) NOT NULL CHECK (weight_kg > 0),
  height_cm numeric(8,2) NOT NULL CHECK (height_cm > 0),
  width_cm numeric(8,2) NOT NULL CHECK (width_cm > 0),
  length_cm numeric(8,2) NOT NULL CHECK (length_cm > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipping_package_presets_company_idx
  ON public.shipping_package_presets (company_id, created_at);

ALTER TABLE public.shipping_package_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presets_select" ON public.shipping_package_presets;
CREATE POLICY "presets_select" ON public.shipping_package_presets
  FOR SELECT USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "presets_insert" ON public.shipping_package_presets;
CREATE POLICY "presets_insert" ON public.shipping_package_presets
  FOR INSERT WITH CHECK (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "presets_update" ON public.shipping_package_presets;
CREATE POLICY "presets_update" ON public.shipping_package_presets
  FOR UPDATE USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS "presets_delete" ON public.shipping_package_presets;
CREATE POLICY "presets_delete" ON public.shipping_package_presets
  FOR DELETE USING (public.user_has_company_access(company_id));
