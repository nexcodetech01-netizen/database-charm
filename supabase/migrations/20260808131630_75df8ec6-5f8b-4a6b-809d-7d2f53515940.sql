CREATE OR REPLACE FUNCTION public.get_daily_revenue(_company_id uuid, _start_date date DEFAULT NULL, _end_date date DEFAULT NULL)
 RETURNS TABLE(total_revenue numeric, total_received numeric, transaction_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p_start date;
  p_end date;
BEGIN
  -- Normaliza datas para o fuso de Brasília
  p_start := COALESCE(_start_date, (timezone('America/Sao_Paulo', now()))::date);
  p_end   := COALESCE(_end_date, p_start);

  RETURN QUERY
  WITH daily_sales AS (
    SELECT COALESCE(SUM(total_amount), 0) as gross
    FROM public.sales
    WHERE company_id = _company_id
      AND (timezone('America/Sao_Paulo', created_at))::date BETWEEN p_start AND p_end
      AND status != 'canceled'
  ),
  daily_received AS (
    SELECT 
      COALESCE(SUM(amount), 0) as received,
      COUNT(*) as cnt
    FROM public.financial_transactions
    WHERE company_id = _company_id
      AND type = 'income'
      AND status = 'paid'
      AND (timezone('America/Sao_Paulo', paid_at))::date BETWEEN p_start AND p_end
  )
  SELECT 
    s.gross::numeric,
    r.received::numeric,
    r.cnt
  FROM daily_sales s, daily_received r;
END;
$function$;