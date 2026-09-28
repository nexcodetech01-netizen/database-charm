-- =====================================================================
-- Produtos mais vendidos no período — usado pelo resumo quinzenal da
-- Bella (notificação "Resumo quinzenal: mais vendidos e reposição").
--
-- Mesmas regras de venda do dashboard (dashboard_revenue_between):
-- status 'paid' ou 'partially_paid', fora da lixeira, sem homologação,
-- pela data de criação.
--
-- Chamada pelo job (service role, sem auth.uid()) ou por um usuário da
-- empresa — nesse caso o acesso é conferido.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.top_selling_products(
  _company_id uuid,
  _days integer DEFAULT 15,
  _limit integer DEFAULT 5
)
RETURNS TABLE(product_id uuid, name text, quantity numeric, revenue numeric)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _company_id IS NULL THEN
    RAISE EXCEPTION '_company_id é obrigatório';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT si.product_id,
         p.name::text,
         SUM(si.quantity)::numeric AS quantity,
         SUM(si.total)::numeric AS revenue
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    JOIN products p ON p.id = si.product_id
   WHERE s.company_id = _company_id
     AND s.status IN ('paid', 'partially_paid')
     AND s.deleted_at IS NULL
     AND s.is_test = false
     AND s.created_at >= now() - make_interval(days => GREATEST(_days, 1))
     AND si.product_id IS NOT NULL
   GROUP BY si.product_id, p.name
   ORDER BY SUM(si.quantity) DESC, SUM(si.total) DESC
   LIMIT GREATEST(LEAST(_limit, 50), 1);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.top_selling_products(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.top_selling_products(uuid, integer, integer) TO authenticated, service_role;
