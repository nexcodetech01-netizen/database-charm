CREATE TABLE IF NOT EXISTS public.resellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    document TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.consignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
    sent_at DATE NOT NULL DEFAULT CURRENT_DATE,
    commission_type TEXT NOT NULL,
    commission_value NUMERIC(15,2) NOT NULL,
    status TEXT DEFAULT 'ativa' NOT NULL,
    contract_pdf_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.consignment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    consignment_id UUID NOT NULL REFERENCES public.consignments(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sent_quantity INTEGER NOT NULL CHECK (sent_quantity > 0),
    sold_quantity INTEGER DEFAULT 0 NOT NULL,
    returned_quantity INTEGER DEFAULT 0 NOT NULL,
    cost_price NUMERIC(15,2) NOT NULL,
    suggested_price NUMERIC(15,2),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT qty_check CHECK (sold_quantity + returned_quantity <= sent_quantity)
);

CREATE TABLE IF NOT EXISTS public.consignment_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    consignment_id UUID NOT NULL REFERENCES public.consignments(id) ON DELETE CASCADE,
    settled_at DATE NOT NULL DEFAULT CURRENT_DATE,
    items_snapshot JSONB NOT NULL,
    gross_amount NUMERIC(15,2) NOT NULL,
    reseller_commission NUMERIC(15,2) NOT NULL,
    net_receivable NUMERIC(15,2) NOT NULL,
    payment_status TEXT DEFAULT 'pendente' NOT NULL,
    paid_at DATE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resellers TO authenticated;
GRANT ALL ON public.resellers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consignments TO authenticated;
GRANT ALL ON public.consignments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consignment_items TO authenticated;
GRANT ALL ON public.consignment_items TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consignment_settlements TO authenticated;
GRANT ALL ON public.consignment_settlements TO service_role;

ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignment_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their company's resellers" ON public.resellers
    FOR ALL TO authenticated USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

CREATE POLICY "Users can only access their company's consignments" ON public.consignments
    FOR ALL TO authenticated USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

CREATE POLICY "Users can only access their company's consignment items" ON public.consignment_items
    FOR ALL TO authenticated USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

CREATE POLICY "Users can only access their company's consignment settlements" ON public.consignment_settlements
    FOR ALL TO authenticated USING (company_id = (auth.jwt() ->> 'company_id')::uuid);
