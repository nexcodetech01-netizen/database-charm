-- FIX — view_cash_session_summary não excluía vendas de teste (is_test).
--
-- Achado na auditoria do caixa (2026-08-13): o app tem um conceito de
-- "venda de teste" (sales.is_test) usado em vários outros lugares do
-- sistema (dashboard, relatórios) sempre excluído por padrão das métricas
-- reais — inclusive o próprio hook useCashSummary já tem
-- `includeTest = false` como padrão. Mas a view usada pra calcular o
-- resumo do caixa (sales_count, sales_total, cash_sales, expected_cash)
-- nunca filtrava is_test — uma venda de teste inflava o "dinheiro
-- esperado" mostrado ao operador no fechamento de caixa, mesmo com a
-- opção de excluir testes ligada (padrão).
--
-- Fix: a view agora exclui is_test=true da mesma forma que o resto do
-- sistema já faz (padrão `NOT COALESCE(is_test,false)`, visto em outras
-- funções como a de métricas de dashboard).

CREATE OR REPLACE VIEW public.view_cash_session_summary AS
WITH session_sales_stats AS (
    SELECT cash_session_id, COUNT(*) as sales_count
    FROM public.sales
    WHERE status IN ('paid', 'partially_paid')
      AND NOT COALESCE(is_test, false)
    GROUP BY cash_session_id
),
session_receipts AS (
    SELECT
        COALESCE(settlement_session_id, (
            SELECT id FROM public.cash_sessions cs
            WHERE ft.company_id = cs.company_id
              AND ft.paid_at >= cs.opened_at
              AND (cs.closed_at IS NULL OR ft.paid_at <= cs.closed_at)
            ORDER BY cs.opened_at DESC LIMIT 1
        )) as session_id,
        SUM(amount) as total_received,
        SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END) as cash_received
    FROM public.financial_transactions ft
    LEFT JOIN public.sales s ON s.id = ft.reference_id AND ft.source = 'sale'
    WHERE ft.status = 'paid' AND ft.type = 'income'
      AND NOT COALESCE(s.is_test, false)
    GROUP BY 1
),
session_movements AS (
    SELECT
        session_id,
        SUM(CASE WHEN type = 'cash_in' AND reason NOT IN ('baixa financeira', 'saneamento de baixa', 'estorno de baixa financeira') THEN amount ELSE 0 END) as manual_in,
        SUM(CASE WHEN type = 'cash_out' AND reason NOT IN ('baixa financeira', 'saneamento de baixa', 'estorno de baixa financeira') THEN amount ELSE 0 END) as manual_out
    FROM public.cash_movements
    GROUP BY session_id
)
SELECT
    cs.id as session_id,
    cs.company_id,
    cs.status as session_status,
    cs.opening_balance,
    COALESCE(sr.total_received, 0) as sales_total,
    COALESCE(ss.sales_count, 0) as sales_count,
    COALESCE(sm.manual_in, 0) as cash_in,
    COALESCE(sm.manual_out, 0) as cash_out,
    COALESCE(sr.cash_received, 0) as cash_sales,
    (cs.opening_balance + COALESCE(sr.cash_received, 0) + COALESCE(sm.manual_in, 0) - COALESCE(sm.manual_out, 0)) as expected_cash,
    cs.opened_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' as opened_at_local
FROM public.cash_sessions cs
LEFT JOIN session_sales_stats ss ON ss.cash_session_id = cs.id
LEFT JOIN session_receipts sr ON sr.session_id = cs.id
LEFT JOIN session_movements sm ON sm.session_id = cs.id;

GRANT SELECT ON public.view_cash_session_summary TO authenticated;
GRANT SELECT ON public.view_cash_session_summary TO service_role;
