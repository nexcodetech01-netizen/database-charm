ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ml_item_id text,
  ADD COLUMN IF NOT EXISTS ml_permalink text,
  ADD COLUMN IF NOT EXISTS ml_published_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_products_ml_item_id ON public.products(ml_item_id) WHERE ml_item_id IS NOT NULL;