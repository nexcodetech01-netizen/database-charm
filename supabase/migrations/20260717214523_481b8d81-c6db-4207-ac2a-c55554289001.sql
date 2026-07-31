-- Margem padrão por categoria + toggle no produto
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS default_margin_pct NUMERIC(5,2);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS use_category_margin BOOLEAN NOT NULL DEFAULT true;

-- Produtos já existentes preservam a margem atual (não sofrem recálculo silencioso).
UPDATE public.products SET use_category_margin = false WHERE created_at < now();