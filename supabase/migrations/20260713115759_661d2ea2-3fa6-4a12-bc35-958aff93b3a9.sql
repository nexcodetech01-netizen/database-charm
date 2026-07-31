
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#2563EB',
  ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'Tag',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON public.product_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_company_status ON public.product_categories(company_id, status);

DROP TRIGGER IF EXISTS set_product_categories_updated_at ON public.product_categories;
CREATE TRIGGER set_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
