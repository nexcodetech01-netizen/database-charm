CREATE TABLE public.products_backup_cost_audit_geral_20260802 (
  id uuid,
  name text,
  sku text,
  company_id uuid,
  cost numeric,
  freight numeric,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.products_backup_cost_audit_geral_20260802 TO service_role;

ALTER TABLE public.products_backup_cost_audit_geral_20260802 ENABLE ROW LEVEL SECURITY;

INSERT INTO public.products_backup_cost_audit_geral_20260802 (id, name, sku, company_id, cost, freight)
SELECT p.id, p.name, p.sku, p.company_id, p.cost, p.freight
FROM public.products p;