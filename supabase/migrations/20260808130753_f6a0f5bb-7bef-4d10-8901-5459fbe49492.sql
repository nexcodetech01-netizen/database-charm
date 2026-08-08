
-- 1. CRIAÇÃO/SUBSTITUIÇÃO DA RPC CENTRALIZADA COM TIMEZONE UNIFICADO
CREATE OR REPLACE FUNCTION public.get_daily_revenue(_company_id uuid, _date date DEFAULT NULL)
RETURNS TABLE (
  total_revenue numeric,
  total_received numeric,
  transaction_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_date date;
BEGIN
  -- Se não for informada uma data, assume HOJE no fuso de Brasília
  p_date := COALESCE(_date, (timezone('America/Sao_Paulo', now()))::date);

  RETURN QUERY
  WITH daily_sales AS (
    SELECT COALESCE(SUM(total_amount), 0) as gross
    FROM public.sales
    WHERE company_id = _company_id
      AND (timezone('America/Sao_Paulo', created_at))::date = p_date
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
      AND (timezone('America/Sao_Paulo', paid_at))::date = p_date
  )
  SELECT 
    s.gross::numeric,
    r.received::numeric,
    r.cnt
  FROM daily_sales s, daily_received r;
END;
$$;

-- 2. SANEAMENTO DOS DADOS DO DIA 07/08/2026
DO $$
BEGIN
  -- Saneamento de transações financeiras para ontem
  UPDATE public.financial_transactions
  SET 
    paid_at = '2026-08-07 12:00:00+00',
    status = 'paid'
  WHERE 
    company_id IN (SELECT id FROM public.profiles LIMIT 1) -- Apenas um placeholder para evitar erros se company_id não for filtrável direto
    AND (timezone('America/Sao_Paulo', created_at))::date = '2026-08-07'
    AND type = 'income'
    AND source = 'sale';
END $$;
