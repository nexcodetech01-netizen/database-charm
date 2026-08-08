-- Dropar versão anterior para mudar assinatura de retorno
DROP FUNCTION IF EXISTS public.get_daily_revenue(uuid, date);

-- 1. Nova RPC de Receita Diária (SSOT)
CREATE OR REPLACE FUNCTION public.get_daily_revenue(_company_id uuid, _date date DEFAULT NULL)
RETURNS TABLE (
    total_revenue numeric, -- Faturamento Bruto
    transaction_count bigint,
    total_received numeric -- Fluxo de Caixa Real
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_date date;
BEGIN
    v_date := COALESCE(_date, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date);
    
    RETURN QUERY
    WITH daily_sales AS (
        SELECT COALESCE(SUM(grand_total), 0) as gross_revenue
        FROM public.sales
        WHERE company_id = _company_id
          AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date = v_date
    ),
    daily_cash_flow AS (
        SELECT 
            COALESCE(SUM(amount), 0) as received_today,
            COUNT(*) as income_count
        FROM public.financial_transactions
        WHERE company_id = _company_id
          AND type = 'income'
          AND status = 'paid'
          AND (paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date = v_date
    )
    SELECT 
        ds.gross_revenue::numeric,
        dcf.income_count::bigint,
        dcf.received_today::numeric
    FROM daily_sales ds, daily_cash_flow dcf;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_revenue(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_revenue(uuid, date) TO service_role;

-- 2. Saneamento: Corrigir paid_at de transações que caíram "no amanhã" devido ao fuso horário
UPDATE public.financial_transactions
SET paid_at = paid_at - interval '24 hours'
WHERE status = 'paid' 
  AND paid_at >= '2026-08-08 00:00:00+00'
  AND (paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
