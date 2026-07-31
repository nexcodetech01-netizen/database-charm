
-- Sprint 10.2: cross-link payment_events with domain entities for timeline queries
ALTER TABLE public.payment_events
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS bella_pay_charge_id uuid REFERENCES public.bella_pay_charges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS financial_transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payment_events_company_idx ON public.payment_events(company_id, event_type);
CREATE INDEX IF NOT EXISTS payment_events_charge_idx ON public.payment_events(bella_pay_charge_id);
CREATE INDEX IF NOT EXISTS payment_events_sale_idx ON public.payment_events(sale_id);
CREATE INDEX IF NOT EXISTS payment_events_customer_idx ON public.payment_events(customer_id);
CREATE INDEX IF NOT EXISTS payment_events_payment_idx ON public.payment_events(payment_id);
