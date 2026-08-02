ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS margin_mode text NOT NULL DEFAULT 'margin';

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_margin_mode_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_margin_mode_check
  CHECK (margin_mode IN ('margin', 'markup'));

COMMENT ON COLUMN public.products.margin_mode IS
  'Interpretacao do campo margin: margin = percentual sobre o preco de venda; markup = percentual sobre o custo total. Default margin preserva o comportamento historico.';