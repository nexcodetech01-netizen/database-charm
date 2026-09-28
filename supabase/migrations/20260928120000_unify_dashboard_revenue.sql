-- =====================================================================
-- Dashboard: uma regra só para todos os filtros de período.
--
-- Antes, "Hoje/Ontem/Este Mês" usavam get_dashboard_metrics e
-- "7 Dias/Personalizado" usavam get_daily_revenue, com regras diferentes
-- (a segunda contava canceladas — filtrava 'canceled' em vez de
-- 'cancelled' —, rascunhos, pendentes e vendas na lixeira).
--
-- Regras (decididas em 2026-09-28):
--   Receita do período = vendas com status 'paid' ou 'partially_paid',
--     pelo grand_total, fora da lixeira, sem vendas de homologação
--     (is_test), pela data de criação no fuso America/Sao_Paulo.
--   Recebido = entradas pagas no financeiro pela data do pagamento, sem
--     aportes de sócio e sem recebimentos de vendas de homologação.
--   Quantidade = número de vendas que compõem a receita.
--
-- Segurança: get_daily_revenue rodava como SECURITY DEFINER sem checar
-- se o usuário pertence à empresa — qualquer um com a chave pública lia
-- o faturamento de qualquer empresa pelo ID. Agora todas rodam com as
-- permissões do usuário (RLS) e checam o acesso explicitamente.
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
       AND s.status IN ('paid', 'partially_paid')
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

-- Hoje / Ontem / Este Mês
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_company_id uuid,
  p_period text DEFAULT 'hoje'::text
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := timezone('America/Sao_Paulo', now())::date;
  v_start date;
  v_end date;
  v_row record;
BEGIN
  IF p_period = 'ontem' THEN
    v_start := v_today - 1;
    v_end := v_start;
  ELSIF p_period = 'mes' THEN
    v_start := date_trunc('month', v_today)::date;
    v_end := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
  ELSE
    v_start := v_today;
    v_end := v_today;
  END IF;

  SELECT * INTO v_row FROM public.dashboard_revenue_between(p_company_id, v_start, v_end);

  RETURN json_build_object(
    'gross_revenue', v_row.gross_revenue,
    'net_received', v_row.net_received,
    'transaction_count', v_row.sales_count
  );
END;
$function$;

-- 7 Dias / Personalizado (mesma assinatura e formato de retorno de antes).
-- Remove uma eventual versão antiga de 2 parâmetros que ainda exista.
DROP FUNCTION IF EXISTS public.get_daily_revenue(uuid, date);

CREATE OR REPLACE FUNCTION public.get_daily_revenue(
  _company_id uuid,
  _start_date date DEFAULT NULL::date,
  _end_date date DEFAULT NULL::date
)
RETURNS TABLE(total_revenue numeric, total_received numeric, transaction_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start date := COALESCE(_start_date, timezone('America/Sao_Paulo', now())::date);
  v_end date := COALESCE(_end_date, v_start);
BEGIN
  RETURN QUERY
  SELECT d.gross_revenue, d.net_received, d.sales_count
    FROM public.dashboard_revenue_between(_company_id, v_start, v_end) d;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.dashboard_revenue_between(uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_metrics(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_daily_revenue(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_revenue_between(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_revenue(uuid, date, date) TO authenticated, service_role;
