-- Renomear default_margin_pct -> target_margin_pct e adicionar min_margin_pct
ALTER TABLE public.product_categories
  RENAME COLUMN default_margin_pct TO target_margin_pct;

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS min_margin_pct NUMERIC(6,2);

COMMENT ON COLUMN public.product_categories.target_margin_pct IS
  'Margem alvo (%) usada pela Bella IA para calcular o preço sugerido da categoria.';
COMMENT ON COLUMN public.product_categories.min_margin_pct IS
  'Margem mínima (%) usada para validar descontos no PDV.';