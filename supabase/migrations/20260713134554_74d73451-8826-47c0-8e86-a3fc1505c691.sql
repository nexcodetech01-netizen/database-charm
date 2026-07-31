
-- 1) bella_pay_config
CREATE TABLE public.bella_pay_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  api_key_sandbox TEXT,
  api_key_production TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  connection_status TEXT NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN ('disconnected','connected','error')),
  connection_message TEXT,
  webhook_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bella_pay_config TO authenticated;
GRANT ALL ON public.bella_pay_config TO service_role;
ALTER TABLE public.bella_pay_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage bella_pay_config" ON public.bella_pay_config
  FOR ALL USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER trg_bella_pay_config_updated
  BEFORE UPDATE ON public.bella_pay_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) bella_pay_charges
CREATE TABLE public.bella_pay_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  financial_transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  asaas_id TEXT NOT NULL,
  asaas_customer_id TEXT,
  billing_type TEXT NOT NULL CHECK (billing_type IN ('PIX','CREDIT_CARD','UNDEFINED')),
  value NUMERIC(14,2) NOT NULL,
  net_value NUMERIC(14,2),
  due_date DATE NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  invoice_url TEXT,
  payment_link TEXT,
  pix_qr_code TEXT,
  pix_payload TEXT,
  external_reference TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  paid_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, asaas_id)
);
CREATE INDEX idx_bella_pay_charges_company ON public.bella_pay_charges(company_id);
CREATE INDEX idx_bella_pay_charges_sale ON public.bella_pay_charges(sale_id);
CREATE INDEX idx_bella_pay_charges_ftx ON public.bella_pay_charges(financial_transaction_id);
CREATE INDEX idx_bella_pay_charges_status ON public.bella_pay_charges(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bella_pay_charges TO authenticated;
GRANT ALL ON public.bella_pay_charges TO service_role;
ALTER TABLE public.bella_pay_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage bella_pay_charges" ON public.bella_pay_charges
  FOR ALL USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER trg_bella_pay_charges_updated
  BEFORE UPDATE ON public.bella_pay_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) webhook events (service-role only)
CREATE TABLE public.bella_pay_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  asaas_event_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bella_pay_webhook_events_type ON public.bella_pay_webhook_events(event_type);
GRANT ALL ON public.bella_pay_webhook_events TO service_role;
ALTER TABLE public.bella_pay_webhook_events ENABLE ROW LEVEL SECURITY;
-- no policies: only service role reads/writes

-- 4) referências no financeiro
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS asaas_charge_id TEXT,
  ADD COLUMN IF NOT EXISTS bella_pay_charge_id UUID REFERENCES public.bella_pay_charges(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_financial_transactions_asaas ON public.financial_transactions(asaas_charge_id);
