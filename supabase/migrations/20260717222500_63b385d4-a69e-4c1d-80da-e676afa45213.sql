ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS focal_x numeric(6,3) NOT NULL DEFAULT 50.000,
  ADD COLUMN IF NOT EXISTS focal_y numeric(6,3) NOT NULL DEFAULT 50.000,
  ADD COLUMN IF NOT EXISTS zoom    numeric(4,2) NOT NULL DEFAULT 1.00;

ALTER TABLE public.product_images
  DROP CONSTRAINT IF EXISTS product_images_focal_x_range,
  DROP CONSTRAINT IF EXISTS product_images_focal_y_range,
  DROP CONSTRAINT IF EXISTS product_images_zoom_range;

ALTER TABLE public.product_images
  ADD CONSTRAINT product_images_focal_x_range CHECK (focal_x >= 0 AND focal_x <= 100),
  ADD CONSTRAINT product_images_focal_y_range CHECK (focal_y >= 0 AND focal_y <= 100),
  ADD CONSTRAINT product_images_zoom_range    CHECK (zoom    >= 1 AND zoom    <= 10);

COMMENT ON COLUMN public.product_images.focal_x IS 'Posição horizontal do enquadramento (object-position X, 0..100).';
COMMENT ON COLUMN public.product_images.focal_y IS 'Posição vertical do enquadramento (object-position Y, 0..100).';
COMMENT ON COLUMN public.product_images.zoom    IS 'Fator de zoom sobre o object-cover (1 = sem zoom).';