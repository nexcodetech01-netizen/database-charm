-- Ajuste de Timezone para a RPC de Receita Diária (Sintaxe AT TIME ZONE)
CREATE OR REPLACE FUNCTION public.get_daily_revenue(_company_id uuid, _date date DEFAULT NULL)
RETURNS TABLE (
    total_revenue numeric,
    transaction_count bigint
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
    SELECT 
        COALESCE(SUM(amount), 0) as total_revenue,
        COUNT(*) as transaction_count
    FROM public.financial_transactions
    WHERE company_id = _company_id
      AND type = 'income'
      AND status = 'paid'
      AND (paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date = v_date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_revenue(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_revenue(uuid, date) TO service_role;
