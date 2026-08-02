ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS auto_pricing_policy boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.product_categories.auto_pricing_policy IS
  'Quando true, novos produtos da categoria usam automaticamente a margem da categoria (Motor Comercial V2).';

CREATE TABLE IF NOT EXISTS public.pricing_market_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  category_key text NOT NULL,
  label text NOT NULL,
  conservative_pct numeric(5,2) NOT NULL CHECK (conservative_pct >= 0 AND conservative_pct < 100),
  common_pct numeric(5,2) NOT NULL CHECK (common_pct >= 0 AND common_pct < 100),
  premium_pct numeric(5,2) NOT NULL CHECK (premium_pct >= 0 AND premium_pct < 100),
  source_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pricing_market_references_global_key
  ON public.pricing_market_references (category_key) WHERE company_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pricing_market_references_company_key
  ON public.pricing_market_references (company_id, category_key) WHERE company_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_market_references TO authenticated;
GRANT ALL ON public.pricing_market_references TO service_role;

ALTER TABLE public.pricing_market_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_refs_select" ON public.pricing_market_references
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR public.user_has_company_access(company_id));

CREATE POLICY "market_refs_insert" ON public.pricing_market_references
  FOR INSERT TO authenticated
  WITH CHECK (company_id IS NOT NULL AND public.user_has_company_access(company_id));

CREATE POLICY "market_refs_update" ON public.pricing_market_references
  FOR UPDATE TO authenticated
  USING (company_id IS NOT NULL AND public.user_has_company_access(company_id))
  WITH CHECK (company_id IS NOT NULL AND public.user_has_company_access(company_id));

CREATE POLICY "market_refs_delete" ON public.pricing_market_references
  FOR DELETE TO authenticated
  USING (company_id IS NOT NULL AND public.user_has_company_access(company_id));

CREATE TRIGGER trg_pricing_market_references_updated_at
  BEFORE UPDATE ON public.pricing_market_references
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

INSERT INTO public.pricing_market_references
  (company_id, category_key, label, conservative_pct, common_pct, premium_pct, source_note)
VALUES
  (NULL, 'relogios', 'Relógios', 35, 55, 70, 'Referência inicial editável'),
  (NULL, 'bolsas', 'Bolsas', 30, 50, 65, 'Referência inicial editável'),
  (NULL, 'carteiras', 'Carteiras', 30, 50, 65, 'Referência inicial editável'),
  (NULL, 'perfumes', 'Perfumes', 25, 45, 60, 'Referência inicial editável'),
  (NULL, 'cosmeticos', 'Cosméticos', 25, 45, 60, 'Referência inicial editável'),
  (NULL, 'bijuterias', 'Bijuterias', 40, 60, 75, 'Referência inicial editável'),
  (NULL, 'acessorios', 'Acessórios', 30, 50, 65, 'Referência inicial editável')
ON CONFLICT DO NOTHING;