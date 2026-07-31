ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ncm text;

ALTER TABLE public.products
  ADD CONSTRAINT products_ncm_format_check
  CHECK (ncm IS NULL OR ncm ~ '^[0-9]{8}$');