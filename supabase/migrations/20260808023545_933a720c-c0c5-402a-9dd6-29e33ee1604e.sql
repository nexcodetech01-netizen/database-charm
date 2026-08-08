CREATE OR REPLACE FUNCTION public.get_daily_revenue(_company_id uuid, _date date DEFAULT NULL::date)
 RETURNS TABLE(total_revenue numeric, transaction_count bigint, total_received numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_date date;
BEGIN
    -- Resolve a data no fuso de Brasília (America/Sao_Paulo)
    v_date := COALESCE(_date, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date);
    
    RETURN QUERY
    WITH daily_sales AS (
        -- PADRONIZAÇÃO DE TIMEZONE: Faturamento Bruto
        SELECT 
            COALESCE(SUM(grand_total), 0) as gross_revenue,
            COUNT(*) as sale_count
        FROM public.sales
        WHERE company_id = _company_id
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_date
          AND status NOT IN ('canceled', 'cancelled')
    ),
    daily_cash_flow AS (
        -- PADRONIZAÇÃO DE TIMEZONE: Fluxo de Caixa Real
        SELECT 
            COALESCE(SUM(amount), 0) as received_today
        FROM public.financial_transactions
        WHERE company_id = _company_id
          AND type = 'income'
          AND status = 'paid'
          AND (paid_at AT TIME ZONE 'America/Sao_Paulo')::date = v_date
    )
    SELECT 
        ds.gross_revenue::numeric,
        ds.sale_count::bigint,
        dcf.received_today::numeric
    FROM daily_sales ds, daily_cash_flow dcf;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_daily_revenue(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_revenue(uuid, date) TO service_role;
