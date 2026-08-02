CREATE TABLE public.products_backup_costs_20260802 AS
SELECT pr.id AS product_id,
       pr.company_id,
       pr.freight,
       pr.packaging,
       pr.insurance,
       pr.other_costs,
       pr.price,
       now() AS backed_up_at
FROM public.products pr
WHERE coalesce(pr.freight,0)=0
  AND coalesce(pr.packaging,0)=0
  AND coalesce(pr.insurance,0)=0
  AND coalesce(pr.other_costs,0)=0;

GRANT ALL ON public.products_backup_costs_20260802 TO service_role;

ALTER TABLE public.products_backup_costs_20260802 ENABLE ROW LEVEL SECURITY;