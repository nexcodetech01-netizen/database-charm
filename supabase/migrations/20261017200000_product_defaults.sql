-- =====================================================================
-- Padrões de produto iguais ao cadastro manual, para TODO caminho que
-- cria produto (importação de compra, Bella, CSV...):
--   unidade "UN", código de barras "SEM GTIN" (o índice único ignora),
--   canais de venda: loja física + catálogo online.
-- Antes: unit 'un' (minúsculo, não aparecia selecionado no cadastro),
-- barcode NULL e sales_channels vazio (produto fora do catálogo).
-- =====================================================================
ALTER TABLE public.products ALTER COLUMN unit SET DEFAULT 'UN';
ALTER TABLE public.products ALTER COLUMN barcode SET DEFAULT 'SEM GTIN';
ALTER TABLE public.products ALTER COLUMN sales_channels SET DEFAULT ARRAY['loja_fisica', 'catalog']::text[];
