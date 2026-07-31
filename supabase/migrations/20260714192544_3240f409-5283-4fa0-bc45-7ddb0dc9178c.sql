
-- P0-03: dedupe de clientes no Asaas
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS asaas_customer_id text;

CREATE UNIQUE INDEX IF NOT EXISTS customers_company_asaas_customer_uidx
  ON public.customers (company_id, asaas_customer_id)
  WHERE asaas_customer_id IS NOT NULL;

-- P0-01 / P0-02: enriquecer bella_pay_webhook_events + idempotência forte
ALTER TABLE public.bella_pay_webhook_events
  ADD COLUMN IF NOT EXISTS payment_id text,
  ADD COLUMN IF NOT EXISTS bella_pay_charge_id uuid REFERENCES public.bella_pay_charges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS financial_transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS charge_status text;

-- Renomear a coluna "error" existente já é ok; garantimos que exista.
-- Índice único para idempotência forte (apenas quando asaas_event_id não é nulo).
CREATE UNIQUE INDEX IF NOT EXISTS bella_pay_webhook_events_asaas_event_uidx
  ON public.bella_pay_webhook_events (asaas_event_id)
  WHERE asaas_event_id IS NOT NULL;

-- Índices auxiliares (não únicos) para timeline/consultas
CREATE INDEX IF NOT EXISTS bella_pay_webhook_events_charge_idx
  ON public.bella_pay_webhook_events (bella_pay_charge_id);
CREATE INDEX IF NOT EXISTS bella_pay_webhook_events_company_created_idx
  ON public.bella_pay_webhook_events (company_id, created_at DESC);
