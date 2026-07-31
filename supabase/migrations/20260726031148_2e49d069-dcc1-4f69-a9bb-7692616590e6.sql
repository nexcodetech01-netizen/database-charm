ALTER TABLE public.sales ALTER COLUMN sale_date DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.set_sale_date_company_today()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sale_date IS NULL THEN
    NEW.sale_date := public.company_today(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_sale_date_company_today ON public.sales;
CREATE TRIGGER trg_set_sale_date_company_today
BEFORE INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.set_sale_date_company_today();