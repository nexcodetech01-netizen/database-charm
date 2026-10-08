-- =====================================================================
-- Resumo financeiro do dia (janela ao abrir o app, 08/10/2026)
--
-- A receber × A pagar, em Vencido / Hoje / Próximos 7 dias (valor e
-- quantidade), mais as listas do que pede ação: recebimentos vencidos e
-- contas a pagar vencidas ou de hoje.
--
-- A receber = títulos pendentes + parcelas do crediário (sem contar o
-- título duplicado de venda de crediário) — a mesma regra de
-- finance_overview.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.daily_finance_summary(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa' USING ERRCODE = '42501';
  END IF;
  v_today := public.company_today(_company_id);

  WITH open_items AS (
    -- Títulos do Financeiro em aberto
    SELECT t.type AS kind,
           coalesce(t.due_date, t.transaction_date) AS due,
           coalesce(t.amount, 0) AS amount,
           t.description AS label,
           cu.name AS person
      FROM financial_transactions t
      LEFT JOIN sales s ON t.source = 'sale' AND s.id = t.reference_id
      LEFT JOIN customers cu ON cu.id = s.customer_id
     WHERE t.company_id = _company_id
       AND t.type IN ('income', 'expense')
       AND t.status IN ('pending', 'overdue')
       AND NOT (t.source = 'sale' AND EXISTS (
             SELECT 1 FROM credit_accounts a WHERE a.sale_id = t.reference_id AND a.status <> 'cancelled'))
    UNION ALL
    -- Parcelas do crediário em aberto
    SELECT 'income',
           i.due_date,
           i.amount - coalesce(i.paid_amount, 0),
           'Crediário · ' || i.sequence || 'ª parcela' || coalesce(' · ' || s.number, ''),
           cu.name
      FROM credit_installments i
      JOIN credit_accounts a ON a.id = i.credit_account_id
      LEFT JOIN sales s ON s.id = a.sale_id
      LEFT JOIN customers cu ON cu.id = a.customer_id
     WHERE i.company_id = _company_id
       AND i.status IN ('pending', 'partially_paid')
       AND a.status NOT IN ('cancelled', 'settled')
       AND i.amount - coalesce(i.paid_amount, 0) > 0.009
  ),
  buckets AS (
    SELECT kind,
           CASE WHEN due IS NULL OR due < v_today THEN 'overdue'
                WHEN due = v_today THEN 'today'
                WHEN due <= v_today + 7 THEN 'next7'
           END AS bucket,
           amount, due, label, person
      FROM open_items
  )
  SELECT jsonb_build_object(
    'today', v_today,
    'cells', coalesce((
      SELECT jsonb_object_agg(kind || '_' || bucket, jsonb_build_object('total', total, 'count', cnt))
        FROM (SELECT kind, bucket, sum(amount) AS total, count(*) AS cnt
                FROM buckets WHERE bucket IS NOT NULL GROUP BY kind, bucket) g
    ), '{}'::jsonb),
    'overdue_receivables', coalesce((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'person', person, 'due', due,
                                          'days_late', v_today - due, 'amount', amount)
                       ORDER BY due NULLS FIRST)
        FROM (SELECT * FROM buckets WHERE kind = 'income' AND bucket = 'overdue'
               ORDER BY due NULLS FIRST LIMIT 8) x
    ), '[]'::jsonb),
    'payables_due', coalesce((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'due', due,
                                          'days_late', v_today - due, 'amount', amount)
                       ORDER BY due NULLS FIRST)
        FROM (SELECT * FROM buckets WHERE kind = 'expense' AND bucket IN ('overdue', 'today')
               ORDER BY due NULLS FIRST LIMIT 8) x
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.daily_finance_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.daily_finance_summary(uuid) TO authenticated;
