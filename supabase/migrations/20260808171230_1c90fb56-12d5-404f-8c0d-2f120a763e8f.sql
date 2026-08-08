-- 1. Removemos as versões anteriores para evitar ambiguidade de assinatura (overloading)
DROP FUNCTION IF EXISTS public.get_daily_revenue(uuid, date);
DROP FUNCTION IF EXISTS public.get_daily_revenue(uuid, date, date);

-- 2. Criamos a nova versão consolidada e robusta
CREATE OR REPLACE FUNCTION public.get_daily_revenue(
  _company_id uuid, 
  _start_date date DEFAULT NULL, 
  _end_date date DEFAULT NULL
)
RETURNS TABLE(
  total_revenue numeric, 
  total_received numeric, 
  transaction_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p_start date;
  p_end date;
BEGIN
  -- Se não for informada data inicial, assume HOJE (Brasília)
  p_start := COALESCE(_start_date, (timezone('America/Sao_Paulo', now()))::date);
  
  -- Se não for informada data final, assume a mesma da inicial (filtro de dia único)
  p_end := COALESCE(_end_date, p_start);

  RETURN QUERY
  WITH filtered_sales AS (
    -- Faturamento Bruto: Soma do total de vendas criadas no período
    SELECT COALESCE(SUM(total_amount), 0) as gross
    FROM public.sales
    WHERE company_id = _company_id
      AND (timezone('America/Sao_Paulo', created_at))::date BETWEEN p_start AND p_end
      -- Ignoramos apenas canceladas; pendentes e pagas somam na receita
      AND status != 'canceled'
  ),
  filtered_received AS (
    -- Fluxo de Caixa Real: Soma de entradas financeiras confirmadas no período
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
  FROM filtered_sales s, filtered_received r;
END;
$function$;

-- 3. Garantimos permissões
GRANT EXECUTE ON FUNCTION public.get_daily_revenue(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_revenue(uuid, date, date) TO service_role;
