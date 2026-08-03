-- Adição da coluna sales_channels na tabela products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sales_channels text[] DEFAULT '{}';

-- Comentário para documentar a coluna
COMMENT ON COLUMN public.products.sales_channels IS 'Canais de venda onde o produto está disponível: loja_fisica, mercadolivre';

-- Grant para garantir acesso
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
