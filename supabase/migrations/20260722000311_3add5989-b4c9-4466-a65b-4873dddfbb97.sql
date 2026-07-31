
-- 1) Trigger function: cancel related financial transactions when sale is cancelled
CREATE OR REPLACE FUNCTION public.cancel_sale_finance_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.financial_transactions
       SET status = 'cancelled',
           updated_at = now()
     WHERE source = 'sale'
       AND reference_id = NEW.id
       AND status <> 'paid'
       AND status <> 'cancelled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_sale_finance_on_cancel ON public.sales;
CREATE TRIGGER trg_cancel_sale_finance_on_cancel
AFTER UPDATE OF status ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.cancel_sale_finance_on_cancel();

-- 2) Backfill: cancel financial_transactions still pending for already-cancelled sales
UPDATE public.financial_transactions ft
   SET status = 'cancelled',
       updated_at = now()
  FROM public.sales s
 WHERE ft.source = 'sale'
   AND ft.reference_id = s.id
   AND s.status = 'cancelled'
   AND ft.status NOT IN ('paid', 'cancelled');
