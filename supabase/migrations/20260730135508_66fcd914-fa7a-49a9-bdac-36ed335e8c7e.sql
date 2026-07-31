CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Listagem padrão de produtos: WHERE company_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_products_company_created
  ON public.products (company_id, created_at DESC);

-- Busca textual (ILIKE %termo%) em produtos
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm
  ON public.products USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_brand_trgm
  ON public.products USING gin (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_barcode_trgm
  ON public.products USING gin (barcode gin_trgm_ops);

-- Galeria de imagens: WHERE product_id = ? ORDER BY position
CREATE INDEX IF NOT EXISTS idx_product_images_product_position
  ON public.product_images (product_id, "position");

-- Financeiro: company + status (+ vencimento) é o filtro dominante das telas
CREATE INDEX IF NOT EXISTS idx_ft_company_status_due
  ON public.financial_transactions (company_id, status, due_date);

ANALYZE public.products;
ANALYZE public.product_images;
ANALYZE public.financial_transactions;