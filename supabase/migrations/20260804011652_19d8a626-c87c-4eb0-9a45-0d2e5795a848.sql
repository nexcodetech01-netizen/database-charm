ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS width numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS height numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS length numeric DEFAULT 0;

COMMENT ON COLUMN public.products.weight IS 'Peso do produto em KG';
COMMENT ON COLUMN public.products.width IS 'Largura do produto em CM';
COMMENT ON COLUMN public.products.height IS 'Altura do produto em CM';
COMMENT ON COLUMN public.products.length IS 'Comprimento do produto em CM';