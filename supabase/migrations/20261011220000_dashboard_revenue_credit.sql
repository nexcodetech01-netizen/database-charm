-- =====================================================================
-- Dashboard: venda no crediário conta na receita do dia (11/10/2026)
--
-- Desde 08/10 a situação da venda segue o dinheiro recebido: crediário sem
-- entrada fica "pendente". A receita do painel só somava vendas pagas ou
-- pagas em parte, então crediários sem entrada sumiam do faturamento
-- (ex.: 11/10 mostrou só R$ 319,80 de 4 vendas no crediário).
-- Agora crediário (não cancelado) entra na receita pelo total da venda.
-- O "Recebido" não muda: continua sendo só o dinheiro que entrou.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.dashboard_revenue_between(
  p_company_id uuid,
  p_start date,
  p_end date
)
RETURNS TABLE(gross_revenue numeric, net_received numeric, sales_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tz constant text := 'America/Sao_Paulo';
  v_start_ts timestamptz;
  v_end_ts timestamptz;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'p_company_id é obrigatório';
  END IF;
  IF NOT public.user_has_company_access(p_company_id) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa' USING ERRCODE = '42501';
  END IF;

  -- [início do primeiro dia, início do dia seguinte ao último) no fuso local
  v_start_ts := p_start::timestamp AT TIME ZONE v_tz;
  v_end_ts := (p_end + 1)::timestamp AT TIME ZONE v_tz;

  RETURN QUERY
  WITH revenue AS (
    SELECT COALESCE(SUM(s.grand_total), 0)::numeric AS gross, COUNT(*) AS cnt
      FROM sales s
     WHERE s.company_id = p_company_id
       AND (
         s.status IN ('paid', 'partially_paid')
         -- Venda no crediário sem entrada fica "pendente" (nada recebido),
         -- mas é venda feita: entra no faturamento do dia.
         OR (s.status = 'pending' AND EXISTS (
               SELECT 1 FROM credit_accounts a
                WHERE a.sale_id = s.id AND a.status <> 'cancelled'))
       )
       AND s.deleted_at IS NULL
       AND s.is_test = false
       AND s.created_at >= v_start_ts
       AND s.created_at < v_end_ts
  ),
  received AS (
    SELECT COALESCE(SUM(t.amount), 0)::numeric AS total
      FROM financial_transactions t
      LEFT JOIN financial_categories c ON c.id = t.category_id
     WHERE t.company_id = p_company_id
       AND t.type = 'income'
       AND t.status = 'paid'
       AND t.paid_at >= v_start_ts
       AND t.paid_at < v_end_ts
       AND (c.name IS NULL OR c.name <> 'Aporte de Sócio')
       AND NOT EXISTS (
         SELECT 1 FROM sales ts
          WHERE t.source = 'sale'
            AND ts.id = t.reference_id
            AND ts.is_test
       )
  )
  SELECT r.gross, rc.total, r.cnt FROM revenue r, received rc;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.dashboard_revenue_between(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_revenue_between(uuid, date, date) TO authenticated, service_role;
