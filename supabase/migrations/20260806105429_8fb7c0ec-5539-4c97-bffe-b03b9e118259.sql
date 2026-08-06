ALTER TABLE public.products ADD COLUMN IF NOT EXISTS model text;
COMMENT ON COLUMN public.products.model IS 'Modelo do produto para integração com marketplaces e logística';