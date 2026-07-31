
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS asaas_customer_id_sandbox TEXT,
  ADD COLUMN IF NOT EXISTS asaas_customer_id_production TEXT;

-- Backfill: assume legacy asaas_customer_id belongs to the environment
-- currently configured for the customer's company. If unknown, default sandbox.
UPDATE public.customers c
SET asaas_customer_id_production = c.asaas_customer_id
FROM public.bella_pay_config cfg
WHERE cfg.company_id = c.company_id
  AND cfg.environment = 'production'
  AND c.asaas_customer_id IS NOT NULL
  AND c.asaas_customer_id_production IS NULL;

UPDATE public.customers c
SET asaas_customer_id_sandbox = c.asaas_customer_id
FROM public.bella_pay_config cfg
WHERE cfg.company_id = c.company_id
  AND cfg.environment = 'sandbox'
  AND c.asaas_customer_id IS NOT NULL
  AND c.asaas_customer_id_sandbox IS NULL;

-- Customers with legacy id but no matching config → treat as sandbox (safer:
-- a fresh customer will be auto-created in production on next charge).
UPDATE public.customers c
SET asaas_customer_id_sandbox = c.asaas_customer_id
WHERE c.asaas_customer_id IS NOT NULL
  AND c.asaas_customer_id_sandbox IS NULL
  AND c.asaas_customer_id_production IS NULL;
