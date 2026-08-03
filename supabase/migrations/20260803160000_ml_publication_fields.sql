-- Adiciona campos para controle de publicação no Mercado Livre
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ml_status text,
  ADD COLUMN IF NOT EXISTS ml_published_at timestamptz;

-- Garantir acesso ao service_role e authenticated (já deve existir pela tabela, mas por segurança em novas colunas)
GRANT ALL ON public.products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;

-- Index para busca rápida por status ML
CREATE INDEX IF NOT EXISTS idx_products_ml_status ON public.products(ml_status) WHERE ml_status IS NOT NULL;
