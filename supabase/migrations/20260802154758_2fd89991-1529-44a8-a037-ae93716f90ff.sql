ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS max_margin_pct numeric;

COMMENT ON COLUMN public.product_categories.max_margin_pct IS
  'Teto de margem (%) da categoria — usado apenas como alerta pelo motor comercial oficial; nunca corta preço automaticamente.';