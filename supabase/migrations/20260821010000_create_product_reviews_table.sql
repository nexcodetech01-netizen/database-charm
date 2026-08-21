-- Avaliações de produto no catálogo — feature nova (2026-08-21).
--
-- Como o catálogo público não tem login de cliente, avaliações
-- entram como "pendente" e só aparecem publicamente depois de você
-- aprovar (Ferramentas > Avaliações, ou o painel que a IA construir).
-- Isso evita spam/avaliação falsa aparecendo direto sem revisão.

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_company_id ON public.product_reviews (company_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON public.product_reviews (status);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Dono da empresa: vê e modera (aprova/rejeita) todas as avaliações
-- da própria loja, independente do status.
CREATE POLICY "product_reviews_owner_all" ON public.product_reviews FOR ALL TO authenticated
  USING (public.user_owns_company(company_id)) WITH CHECK (public.user_owns_company(company_id));

-- IMPORTANTE: sem policy pública de SELECT direta (mesmo motivo já
-- documentado em `shipments`) — tanto a LEITURA das avaliações
-- aprovadas quanto o ENVIO de uma avaliação nova passam por server
-- functions, que filtram/validam no servidor antes de tocar no banco.

COMMENT ON TABLE public.product_reviews IS 'Avaliações de clientes por produto, com moderação (pending/approved/rejected) antes de aparecer no catálogo público.';
