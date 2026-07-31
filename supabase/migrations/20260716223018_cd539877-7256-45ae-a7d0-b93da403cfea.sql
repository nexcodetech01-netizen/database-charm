
ALTER TABLE public.product_collections
  ADD COLUMN IF NOT EXISTS cta_mode text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS show_price boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_installments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_brand boolean NOT NULL DEFAULT true;

ALTER TABLE public.product_collections
  DROP CONSTRAINT IF EXISTS product_collections_cta_mode_check;

ALTER TABLE public.product_collections
  ADD CONSTRAINT product_collections_cta_mode_check
  CHECK (cta_mode IN ('whatsapp','entrada','comprar_agora'));
