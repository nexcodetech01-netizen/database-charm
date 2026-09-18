REVOKE ALL ON FUNCTION public.reverse_purchase_inventory_on_cancel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_purchase_finance_on_cancel() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_purchase_inventory_on_cancel() TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_purchase_finance_on_cancel() TO service_role;