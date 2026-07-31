REVOKE ALL ON FUNCTION public.cancel_sale_finance_on_cancel() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_sale_finance_on_cancel() FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_sale_finance_on_cancel() TO service_role;

REVOKE ALL ON FUNCTION public.cancel_credit_account_on_sale_cancel() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_credit_account_on_sale_cancel() FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_credit_account_on_sale_cancel() TO service_role;