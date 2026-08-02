ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS margin_policy_source text NOT NULL DEFAULT 'sugestao';

ALTER TABLE public.product_categories
  DROP CONSTRAINT IF EXISTS product_categories_margin_policy_source_check;

ALTER TABLE public.product_categories
  ADD CONSTRAINT product_categories_margin_policy_source_check
  CHECK (margin_policy_source IN ('sugestao', 'empresa'));

COMMENT ON COLUMN public.product_categories.margin_policy_source IS
  'sugestao = valores de referência inicial (ainda não confirmados pelo usuário); empresa = política comercial confirmada pela empresa (soberana).';