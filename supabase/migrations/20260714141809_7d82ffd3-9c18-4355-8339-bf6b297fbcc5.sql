-- ============================================================
-- Pricing Engine — Persistence Layer (Fase P4)
-- ============================================================

-- COMPANY POLICIES ------------------------------------------------
CREATE TABLE public.company_pricing_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  envelope JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT company_pricing_policies_company_unique UNIQUE (company_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_pricing_policies TO authenticated;
GRANT ALL ON public.company_pricing_policies TO service_role;
ALTER TABLE public.company_pricing_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_pricing_policies_owner_all ON public.company_pricing_policies
  FOR ALL USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER update_company_pricing_policies_updated_at
  BEFORE UPDATE ON public.company_pricing_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CATEGORY POLICIES -----------------------------------------------
CREATE TABLE public.category_pricing_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id UUID NOT NULL,
  envelope JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT category_pricing_policies_category_unique UNIQUE (company_id, category_id)
);
CREATE INDEX idx_category_pricing_policies_company ON public.category_pricing_policies(company_id) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_pricing_policies TO authenticated;
GRANT ALL ON public.category_pricing_policies TO service_role;
ALTER TABLE public.category_pricing_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY category_pricing_policies_owner_all ON public.category_pricing_policies
  FOR ALL USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER update_category_pricing_policies_updated_at
  BEFORE UPDATE ON public.category_pricing_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRODUCT POLICIES ------------------------------------------------
CREATE TABLE public.product_pricing_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  envelope JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT product_pricing_policies_product_unique UNIQUE (company_id, product_id)
);
CREATE INDEX idx_product_pricing_policies_company ON public.product_pricing_policies(company_id) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_pricing_policies TO authenticated;
GRANT ALL ON public.product_pricing_policies TO service_role;
ALTER TABLE public.product_pricing_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_pricing_policies_owner_all ON public.product_pricing_policies
  FOR ALL USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER update_product_pricing_policies_updated_at
  BEFORE UPDATE ON public.product_pricing_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRICE LISTS -----------------------------------------------------
CREATE TABLE public.price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  price_list_key TEXT NOT NULL,
  name TEXT,
  currency TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  envelope JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT price_lists_key_unique UNIQUE (company_id, price_list_key)
);
CREATE INDEX idx_price_lists_company ON public.price_lists(company_id) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_lists TO authenticated;
GRANT ALL ON public.price_lists TO service_role;
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY price_lists_owner_all ON public.price_lists
  FOR ALL USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER update_price_lists_updated_at
  BEFORE UPDATE ON public.price_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRICE LIST ENTRIES ----------------------------------------------
CREATE TABLE public.price_list_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  min_qty NUMERIC,
  max_qty NUMERIC,
  fallback TEXT NOT NULL DEFAULT 'derived',
  priority INTEGER NOT NULL DEFAULT 0,
  entry JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT price_list_entries_fallback_check CHECK (fallback IN ('derived','reject')),
  CONSTRAINT price_list_entries_price_check CHECK (price_cents >= 0)
);
CREATE INDEX idx_price_list_entries_list ON public.price_list_entries(price_list_id);
CREATE INDEX idx_price_list_entries_product ON public.price_list_entries(company_id, product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_list_entries TO authenticated;
GRANT ALL ON public.price_list_entries TO service_role;
ALTER TABLE public.price_list_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY price_list_entries_owner_all ON public.price_list_entries
  FOR ALL USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER update_price_list_entries_updated_at
  BEFORE UPDATE ON public.price_list_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRICING DECISIONS (audit log, append-only) ----------------------
CREATE TABLE public.pricing_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  explain_id TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  calculation_version TEXT NOT NULL,
  context_version TEXT NOT NULL,
  result_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  applied_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  context JSONB NOT NULL,
  result JSONB NOT NULL,
  explanation JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
CREATE INDEX idx_pricing_decisions_company_created ON public.pricing_decisions(company_id, created_at DESC);
CREATE INDEX idx_pricing_decisions_explain ON public.pricing_decisions(explain_id);
CREATE INDEX idx_pricing_decisions_request ON public.pricing_decisions(company_id, request_id);
GRANT SELECT, INSERT ON public.pricing_decisions TO authenticated;
GRANT ALL ON public.pricing_decisions TO service_role;
ALTER TABLE public.pricing_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pricing_decisions_owner_read ON public.pricing_decisions
  FOR SELECT USING (public.user_owns_company(company_id));
CREATE POLICY pricing_decisions_owner_insert ON public.pricing_decisions
  FOR INSERT WITH CHECK (public.user_owns_company(company_id));
-- No UPDATE / DELETE policies: decisions são imutáveis.
