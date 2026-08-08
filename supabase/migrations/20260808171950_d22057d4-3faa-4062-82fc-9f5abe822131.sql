-- Migration to create the Aporte de Sócio category for all companies that don't have it yet
INSERT INTO public.financial_categories (company_id, name, kind, color)
SELECT c.id, 'Aporte de Sócio', 'income', '#3B82F6'
FROM public.companies c
WHERE NOT EXISTS (
    SELECT 1 FROM public.financial_categories fc 
    WHERE fc.company_id = c.id AND fc.name = 'Aporte de Sócio'
);

-- Update get_daily_revenue to exclude 'Aporte de Sócio'
CREATE OR REPLACE FUNCTION public.get_daily_revenue(_company_id uuid, _start_date date DEFAULT NULL::date, _end_date date DEFAULT NULL::date)
 RETURNS TABLE(total_revenue numeric, total_received numeric, transaction_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p_start date;
  p_end date;
BEGIN
  p_start := COALESCE(_start_date, (timezone('America/Sao_Paulo', now()))::date);
  p_end := COALESCE(_end_date, p_start);

  RETURN QUERY
  WITH filtered_sales AS (
    SELECT COALESCE(SUM(total_amount), 0) as gross
    FROM public.sales
    WHERE company_id = _company_id
      AND (timezone('America/Sao_Paulo', created_at))::date BETWEEN p_start AND p_end
      AND status != 'canceled'
  ),
  filtered_received AS (
    SELECT 
      COALESCE(SUM(t.amount), 0) as received,
      COUNT(*) as cnt
    FROM public.financial_transactions t
    LEFT JOIN public.financial_categories c ON t.category_id = c.id
    WHERE t.company_id = _company_id
      AND t.type = 'income'
      AND t.status = 'paid'
      AND (timezone('America/Sao_Paulo', t.paid_at))::date BETWEEN p_start AND p_end
      -- Excluir aportes de sócio da métrica de recebimentos (faturamento de vendas)
      AND (c.name IS NULL OR c.name != 'Aporte de Sócio')
  )
  SELECT 
    s.gross::numeric,
    r.received::numeric,
    r.cnt
  FROM filtered_sales s, filtered_received r;
END;
$function$;