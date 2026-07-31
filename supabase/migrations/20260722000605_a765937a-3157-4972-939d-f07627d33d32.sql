
-- Normaliza qualquer registro existente
UPDATE public.sales
   SET status = LOWER(TRIM(status))
 WHERE status IS NOT NULL
   AND status <> LOWER(TRIM(status));

-- Trigger para forçar lowercase em toda escrita futura
CREATE OR REPLACE FUNCTION public.normalize_sale_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NOT NULL THEN
    NEW.status := LOWER(TRIM(NEW.status));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_sale_status ON public.sales;
CREATE TRIGGER trg_normalize_sale_status
BEFORE INSERT OR UPDATE OF status ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.normalize_sale_status();
