-- 1. DROP para resetar assinatura
DROP FUNCTION IF EXISTS public.get_daily_revenue(uuid, date);

-- 2. Recriação com a fórmula de Receita Bruta solicitada
CREATE OR REPLACE FUNCTION public.get_daily_revenue(_company_id uuid, _date date DEFAULT NULL)
RETURNS TABLE (
    total_revenue numeric,   -- Receita do Período: Soma de total_amount de todas as vendas (Exceto canceladas)
    transaction_count bigint, -- Contagem de vendas do período
    total_received numeric    -- Recebido Hoje: Entradas efetivadas no caixa
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_date date;
BEGIN
    -- Resolve a data no fuso de Brasília (America/Sao_Paulo)
    v_date := COALESCE(_date, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date);
    
    RETURN QUERY
    WITH daily_sales AS (
        -- FÓRMULA SOLICITADA: SOMA DO VALOR TOTAL de todas as vendas criadas no dia, independente do status.
        -- Status != 'canceled' (ou 'cancelled' conforme o padrão da tabela)
        SELECT 
            COALESCE(SUM(grand_total), 0) as gross_revenue,
            COUNT(*) as sale_count
        FROM public.sales
        WHERE company_id = _company_id
          AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date = v_date
          AND status NOT IN ('canceled', 'cancelled')
    ),
    daily_cash_flow AS (
        -- HARMONIZAÇÃO: Total do dinheiro/PIX/cartão efetivamente retido no caixa hoje
        SELECT 
            COALESCE(SUM(amount), 0) as received_today
        FROM public.financial_transactions
        WHERE company_id = _company_id
          AND type = 'income'
          AND status = 'paid'
          AND (paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date = v_date
    )
    SELECT 
        ds.gross_revenue::numeric,
        ds.sale_count::bigint,
        dcf.received_today::numeric
    FROM daily_sales ds, daily_cash_flow dcf;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_revenue(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_revenue(uuid, date) TO service_role;
