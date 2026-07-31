REVOKE ALL ON FUNCTION public.cancel_sale(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_sale(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, text) TO service_role;