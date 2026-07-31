DROP TRIGGER IF EXISTS a_cancel_sale_finance_on_cancel ON public.sales;
DROP TRIGGER IF EXISTS trg_cancel_sale_finance_on_cancel ON public.sales;
DROP TRIGGER IF EXISTS b_cancel_credit_account_on_sale_cancel ON public.sales;
DROP TRIGGER IF EXISTS trg_cancel_credit_account_on_sale_cancel ON public.sales;

CREATE TRIGGER a_cancel_sale_finance_on_cancel
AFTER UPDATE OF status ON public.sales
FOR EACH ROW
WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
EXECUTE FUNCTION public.cancel_sale_finance_on_cancel();

CREATE TRIGGER b_cancel_credit_account_on_sale_cancel
AFTER UPDATE OF status ON public.sales
FOR EACH ROW
WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
EXECUTE FUNCTION public.cancel_credit_account_on_sale_cancel();