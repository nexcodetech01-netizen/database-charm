CREATE TABLE public.products_backup_cost_freight_20260802 (
  id uuid NOT NULL,
  name text,
  sku text,
  company_id uuid,
  cost numeric,
  freight numeric,
  price numeric,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.products_backup_cost_freight_20260802 TO service_role;

ALTER TABLE public.products_backup_cost_freight_20260802 ENABLE ROW LEVEL SECURITY;

INSERT INTO public.products_backup_cost_freight_20260802 (id, name, sku, company_id, cost, freight, price)
SELECT id, name, sku, company_id, cost, freight, price
FROM public.products
WHERE sku IN ('BOL-TRE-PRE-001','BOL-ALC-PRE-002','REL-PUL-BRA-001','REL-MIN-DOU-001','REL-RED-PRE-001','BOL-SOC-PRE-003','CAR-MAS-AZU-002','CAR-MAS-PRE-001');