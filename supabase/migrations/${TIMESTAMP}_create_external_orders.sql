CREATE TABLE public.external_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    marketplace text NOT NULL,
    external_order_id text NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    imported_at timestamptz,
    sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (company_id, marketplace, external_order_id)
);

-- Habilitar RLS
ALTER TABLE public.external_orders ENABLE ROW LEVEL SECURITY;

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_orders TO authenticated;
GRANT ALL ON public.external_orders TO service_role;

-- Políticas
CREATE POLICY "Users can view their company's external orders"
ON public.external_orders FOR SELECT
TO authenticated
USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their company's external orders"
ON public.external_orders FOR UPDATE
TO authenticated
USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Index para busca rápida
CREATE INDEX idx_external_orders_company_status ON public.external_orders (company_id, status);
