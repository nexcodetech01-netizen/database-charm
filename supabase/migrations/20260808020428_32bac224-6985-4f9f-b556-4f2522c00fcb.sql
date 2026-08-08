-- 1. VIEW para Resumo de Sessão de Caixa (Single Source of Truth)
-- Agrega VENDAS, RECEBIMENTOS e MOVIMENTOS da sessão.
-- Para vendas parciais, buscamos o valor real nas transações financeiras vinculadas.
CREATE OR REPLACE VIEW public.view_cash_session_summary AS
WITH session_sales_stats AS (
    SELECT 
        cash_session_id,
        COUNT(*) as sales_count
    FROM public.sales
    WHERE status IN ('paid', 'partially_paid')
    GROUP BY cash_session_id
),
session_receipts AS (
    -- Soma todos os recebimentos vinculados à sessão (vendas diretas + baixas de crediário)
    -- O cash_service já associa financial_transactions a sessões de caixa via settlement_session_id
    -- ou via janela temporal (paid_at). Aqui focamos na associação explícita ou lógica.
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
    WHERE status = 'paid' AND type = 'income'
    GROUP BY 1
),
session_movements AS (
    SELECT 
        session_id,
        SUM(CASE WHEN type = 'cash_in' THEN amount ELSE -amount END) as net_movements,
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
    COALESCE(sr.total_received, 0) as sales_total, -- Na verdade é o TOTAL RECEBIDO (faturamento real)
    COALESCE(ss.sales_count, 0) as sales_count,
    COALESCE(sm.manual_in, 0) as cash_in,
    COALESCE(sm.manual_out, 0) as cash_out,
    COALESCE(sr.cash_received, 0) as cash_sales,
    (cs.opening_balance + COALESCE(sr.cash_received, 0) + COALESCE(sm.net_movements, 0)) as expected_cash
FROM public.cash_sessions cs
LEFT JOIN session_sales_stats ss ON ss.cash_session_id = cs.id
LEFT JOIN session_receipts sr ON sr.session_id = cs.id
LEFT JOIN session_movements sm ON sm.session_id = cs.id;

GRANT SELECT ON public.view_cash_session_summary TO authenticated;
GRANT SELECT ON public.view_cash_session_summary TO service_role;

-- 2. RPC para Receita Diária (Single Source of Truth)
CREATE OR REPLACE FUNCTION public.get_daily_revenue(_company_id uuid, _date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
    total_revenue numeric,
    transaction_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(amount), 0) as total_revenue,
        COUNT(*) as transaction_count
    FROM public.financial_transactions
    WHERE company_id = _company_id
      AND type = 'income'
      AND status = 'paid'
      AND paid_at::date = _date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_revenue(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_revenue(uuid, date) TO service_role;
