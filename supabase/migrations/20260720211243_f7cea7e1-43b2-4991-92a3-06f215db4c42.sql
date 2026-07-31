REVOKE EXECUTE ON FUNCTION public.cancel_sale(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reverse_sale_inventory_on_cancel() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_sale_inventory_on_cancel() TO service_role;

REVOKE EXECUTE ON FUNCTION public.prevent_paid_sale_delete_before_reversal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_paid_sale_delete_before_reversal() TO service_role;