
-- =========================
-- Sale Returns / Refunds
-- =========================

CREATE TABLE public.sale_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  number TEXT NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  total_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed', -- completed | failed
  refund_status TEXT NOT NULL DEFAULT 'not_required', -- not_required | requested | confirmed | failed
  refund_message TEXT,
  bella_pay_charge_id UUID REFERENCES public.bella_pay_charges(id) ON DELETE SET NULL,
  finance_ref UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sale_returns_sale ON public.sale_returns(sale_id);
CREATE INDEX idx_sale_returns_company ON public.sale_returns(company_id);
CREATE UNIQUE INDEX idx_sale_returns_number_company
  ON public.sale_returns(company_id, number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_returns TO authenticated;
GRANT ALL ON public.sale_returns TO service_role;

ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_returns owner access"
  ON public.sale_returns
  FOR ALL
  TO authenticated
  USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));

CREATE TRIGGER trg_sale_returns_updated_at
  BEFORE UPDATE ON public.sale_returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Items

CREATE TABLE public.sale_return_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID NOT NULL REFERENCES public.sale_returns(id) ON DELETE CASCADE,
  sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sale_return_items_return ON public.sale_return_items(return_id);
CREATE INDEX idx_sale_return_items_sale_item ON public.sale_return_items(sale_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_return_items TO authenticated;
GRANT ALL ON public.sale_return_items TO service_role;

ALTER TABLE public.sale_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_return_items via return owner"
  ON public.sale_return_items
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sale_returns r
    WHERE r.id = return_id AND public.user_owns_company(r.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sale_returns r
    WHERE r.id = return_id AND public.user_owns_company(r.company_id)
  ));

-- =========================
-- Permission: sales.return
-- =========================

INSERT INTO public.permissions (code, module, action, description)
VALUES ('sales.return', 'sales', 'return', 'Registrar devoluções e estornos de venda')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.code = 'sales.return'
  AND r.name IN ('owner','admin','gerente','vendas')
ON CONFLICT DO NOTHING;
