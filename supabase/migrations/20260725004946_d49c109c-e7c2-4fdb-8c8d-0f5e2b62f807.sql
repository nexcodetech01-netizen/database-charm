REVOKE ALL ON FUNCTION public.create_credit_sale(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_credit_sale(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_credit_sale(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_credit_sale(jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.receive_credit_payment(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.receive_credit_payment(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.receive_credit_payment(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_credit_payment(jsonb) TO service_role;