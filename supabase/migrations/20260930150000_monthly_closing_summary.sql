-- =====================================================================
-- Fechamento mensal simples (tela Bella Contadora → Fechamento Mensal).
--
-- Resultado do mês:
--   Vendas   = vendas 'paid'/'partially_paid' criadas no mês (mesma regra
--              do dashboard: fora da lixeira e sem homologação)
--   Custo    = custo dos produtos vendidos (sale_items.total_cost)
--   Despesas = despesas PAGAS no mês, exceto:
--                · Mercadoria (vira estoque; já entra no Custo ao vender)
--                · Retiradas das sócias (não é gasto da loja)
--                · Estornos/devoluções (entram como devolução)
--   Lucro    = Vendas − Devoluções − Custo − Despesas
--
-- Retiradas: despesas pagas no mês com categoria "Retirada — …".
-- Pendências: o que impede confiar nos números (despesas sem categoria,
-- itens vendidos sem custo).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.monthly_closing_summary(
  _company_id uuid,
  _month date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tz constant text := 'America/Sao_Paulo';
  v_start date := date_trunc('month', _month)::date;
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_revenue numeric := 0;
  v_sales_count bigint := 0;
  v_cogs numeric := 0;
  v_items_without_cost bigint := 0;
  v_refunds numeric := 0;
  v_expenses jsonb := '[]'::jsonb;
  v_expenses_total numeric := 0;
  v_merch numeric := 0;
  v_withdrawals jsonb := '[]'::jsonb;
  v_withdrawals_total numeric := 0;
  v_uncat_count bigint := 0;
  v_uncat_total numeric := 0;
BEGIN
  IF _company_id IS NULL OR _month IS NULL THEN
    RAISE EXCEPTION 'Empresa e mês são obrigatórios';
  END IF;
  IF NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa' USING ERRCODE = '42501';
  END IF;

  v_start_ts := v_start::timestamp AT TIME ZONE v_tz;
  v_end_ts := (v_start + interval '1 month')::timestamp AT TIME ZONE v_tz;

  -- Vendas + custo dos produtos vendidos
  WITH month_sales AS (
    SELECT s.id, s.grand_total
      FROM sales s
     WHERE s.company_id = _company_id
       AND s.status IN ('paid', 'partially_paid')
       AND s.deleted_at IS NULL
       AND s.is_test = false
       AND s.created_at >= v_start_ts
       AND s.created_at < v_end_ts
  )
  SELECT COALESCE(SUM(ms.grand_total), 0), COUNT(*)
    INTO v_revenue, v_sales_count
    FROM month_sales ms;

  SELECT COALESCE(SUM(si.total_cost), 0),
         COUNT(*) FILTER (WHERE COALESCE(si.total_cost, 0) = 0 AND si.product_id IS NOT NULL)
    INTO v_cogs, v_items_without_cost
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
   WHERE s.company_id = _company_id
     AND s.status IN ('paid', 'partially_paid')
     AND s.deleted_at IS NULL
     AND s.is_test = false
     AND s.created_at >= v_start_ts
     AND s.created_at < v_end_ts;

  -- Saídas pagas no mês, classificadas
  WITH paid_out AS (
    SELECT t.amount,
           t.source,
           t.description,
           c.name AS category
      FROM financial_transactions t
      LEFT JOIN financial_categories c ON c.id = t.category_id
     WHERE t.company_id = _company_id
       AND t.type = 'expense'
       AND t.status = 'paid'
       AND t.paid_at >= v_start_ts
       AND t.paid_at < v_end_ts
  ),
  classified AS (
    SELECT amount,
           category,
           CASE
             WHEN category ILIKE 'Retirada%' THEN 'withdrawal'
             WHEN category = 'Mercadoria' OR source = 'purchase' THEN 'merch'
             WHEN category = 'Estorno de Venda' OR source = 'return'
               OR description ILIKE 'Estorno de venda%' OR description ILIKE 'Devolução venda%'
               THEN 'refund'
             ELSE 'expense'
           END AS kind
      FROM paid_out
  )
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE kind = 'refund'), 0),
    COALESCE(SUM(amount) FILTER (WHERE kind = 'merch'), 0),
    COALESCE(SUM(amount) FILTER (WHERE kind = 'expense'), 0),
    COALESCE(SUM(amount) FILTER (WHERE kind = 'withdrawal'), 0),
    COUNT(*) FILTER (WHERE kind = 'expense' AND category IS NULL),
    COALESCE(SUM(amount) FILTER (WHERE kind = 'expense' AND category IS NULL), 0),
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('category', g.category, 'total', g.total) ORDER BY g.total DESC)
         FROM (SELECT COALESCE(category, 'Sem categoria') AS category, SUM(amount) AS total
                 FROM classified WHERE kind = 'expense'
                GROUP BY 1) g),
      '[]'::jsonb),
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('category', g.category, 'total', g.total) ORDER BY g.category)
         FROM (SELECT category, SUM(amount) AS total
                 FROM classified WHERE kind = 'withdrawal'
                GROUP BY 1) g),
      '[]'::jsonb)
    INTO v_refunds, v_merch, v_expenses_total, v_withdrawals_total,
         v_uncat_count, v_uncat_total, v_expenses, v_withdrawals
    FROM classified;

  RETURN jsonb_build_object(
    'month', to_char(v_start, 'YYYY-MM'),
    'revenue', v_revenue,
    'sales_count', v_sales_count,
    'refunds', v_refunds,
    'cogs', v_cogs,
    'expenses_total', v_expenses_total,
    'expenses', v_expenses,
    'profit', v_revenue - v_refunds - v_cogs - v_expenses_total,
    'merchandise_purchased', v_merch,
    'withdrawals_total', v_withdrawals_total,
    'withdrawals', v_withdrawals,
    'pending', jsonb_build_object(
      'uncategorized_expenses_count', v_uncat_count,
      'uncategorized_expenses_total', v_uncat_total,
      'items_without_cost', v_items_without_cost
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.monthly_closing_summary(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.monthly_closing_summary(uuid, date) TO authenticated, service_role;
