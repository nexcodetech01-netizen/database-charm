
DROP FUNCTION IF EXISTS public.get_daily_revenue(uuid, date);

CREATE OR REPLACE FUNCTION public.get_daily_revenue(_company_id uuid, _date date DEFAULT NULL)
RETURNS TABLE(total_revenue numeric, total_received numeric, transaction_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_date date;
BEGIN
    IF _date IS NULL THEN
        target_date := (timezone('America/Sao_Paulo', now()))::date;
    ELSE
        target_date := _date;
    END IF;

    RETURN QUERY
    WITH daily_sales AS (
        SELECT 
            COALESCE(SUM(grand_total), 0) as revenue,
            COUNT(*) as sales_count
        FROM public.sales
        WHERE company_id = _company_id
          AND status != 'canceled'
          AND (timezone('America/Sao_Paulo', created_at))::date = target_date
    ),
    daily_received AS (
        SELECT 
            COALESCE(SUM(amount), 0) as received
        FROM public.financial_transactions
        WHERE company_id = _company_id
          AND type = 'income'
          AND status = 'paid'
          AND (timezone('America/Sao_Paulo', paid_at))::date = target_date
    )
    SELECT 
        s.revenue::numeric,
        r.received::numeric,
        s.sales_count::bigint
    FROM daily_sales s, daily_received r;
END;
$$;
