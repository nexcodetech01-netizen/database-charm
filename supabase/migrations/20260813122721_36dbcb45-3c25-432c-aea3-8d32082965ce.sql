-- Tabela de Revendedores
CREATE TABLE IF NOT EXISTS public.resellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    name TEXT NOT NULL,
    document TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela de Consignações
CREATE TABLE IF NOT EXISTS public.consignacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
    sent_at DATE NOT NULL,
    commission_type TEXT CHECK (commission_type IN ('percentual', 'valor_fixo')) NOT NULL,
    commission_value NUMERIC NOT NULL,
    status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'fechada', 'cancelada')) NOT NULL,
    contract_pdf_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela de Itens da Consignação
CREATE TABLE IF NOT EXISTS public.consignment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    consignment_id UUID NOT NULL REFERENCES public.consignacoes(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    sent_quantity INTEGER NOT NULL,
    sold_quantity INTEGER DEFAULT 0 NOT NULL,
    returned_quantity INTEGER DEFAULT 0 NOT NULL,
    quantidade_extraviada INTEGER DEFAULT 0 NOT NULL,
    cost_price NUMERIC NOT NULL,
    suggested_price NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela de Fechamentos
CREATE TABLE IF NOT EXISTS public.consignment_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    consignment_id UUID NOT NULL REFERENCES public.consignacoes(id) ON DELETE CASCADE,
    settled_at DATE DEFAULT CURRENT_DATE NOT NULL,
    items_snapshot JSONB NOT NULL,
    gross_amount NUMERIC NOT NULL,
    reseller_commission NUMERIC NOT NULL,
    net_receivable NUMERIC NOT NULL,
    payment_status TEXT DEFAULT 'pendente' CHECK (payment_status IN ('pendente', 'pago')) NOT NULL,
    paid_at DATE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignment_settlements ENABLE ROW LEVEL SECURITY;

-- Nota: Assumindo que o tenant_id/company_id está no claim do JWT como 'company_id' ou 'tenant_id'
-- Ajustando para usar (auth.jwt() ->> 'company_id')::uuid conforme padrão do NexOS

CREATE POLICY "Users can manage their company resellers" ON public.resellers
    FOR ALL USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

CREATE POLICY "Users can manage their company consignments" ON public.consignacoes
    FOR ALL USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

CREATE POLICY "Users can manage their company consignment items" ON public.consignment_items
    FOR ALL USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

CREATE POLICY "Users can manage their company consignment settlements" ON public.consignment_settlements
    FOR ALL USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resellers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consignacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consignment_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consignment_settlements TO authenticated;

GRANT ALL ON public.resellers TO service_role;
GRANT ALL ON public.consignacoes TO service_role;
GRANT ALL ON public.consignment_items TO service_role;
GRANT ALL ON public.consignment_settlements TO service_role;

-- Constraint Trigger for quantities
CREATE OR REPLACE FUNCTION public.check_consignment_quantities()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.sold_quantity + NEW.returned_quantity + (COALESCE(NEW.quantidade_extraviada, 0))) > NEW.sent_quantity THEN
    RAISE EXCEPTION 'A soma de vendidos, devolvidos e extraviados não pode ultrapassar a quantidade enviada.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_consignment_quantities ON public.consignment_items;
CREATE TRIGGER trg_check_consignment_quantities
BEFORE INSERT OR UPDATE ON public.consignment_items
FOR EACH ROW EXECUTE FUNCTION public.check_consignment_quantities();
