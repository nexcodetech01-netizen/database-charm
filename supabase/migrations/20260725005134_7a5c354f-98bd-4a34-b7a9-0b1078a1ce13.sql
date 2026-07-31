REVOKE ALL ON FUNCTION public.reverse_sale_inventory_on_cancel() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reverse_sale_inventory_on_cancel() FROM anon;
GRANT EXECUTE ON FUNCTION public.reverse_sale_inventory_on_cancel() TO service_role;