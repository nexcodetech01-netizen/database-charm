-- =====================================================================
-- Auditoria 04/10/2026 — achado 07: indicadores financeiros no banco.
--
-- financeService.overview carregava TODOS os lançamentos da empresa para
-- somar no navegador. A API do Supabase devolve no máximo 1.000 linhas
-- por consulta: passado esse volume, saldo a receber, a pagar, receita do
-- mês etc. ficariam incompletos sem nenhum aviso. Agora a soma é feita
-- aqui, sobre todas as linhas, e só o resultado trafega.
--
-- Mesmas regras do código anterior (finance.service.ts → overview).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.finance_overview(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date;
  v_tz text;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_month_start timestamptz;
  v_balance numeric := 0;
  v_agg record;
  v_upcoming_income jsonb;
  v_upcoming_expense jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa' USING ERRCODE = '42501';
  END IF;

  v_today := public.company_today(_company_id);
  SELECT coalesce(nullif(trim(timezone), ''), 'America/Sao_Paulo') INTO v_tz
    FROM companies WHERE id = _company_id;
  v_tz := coalesce(v_tz, 'America/Sao_Paulo');
  v_day_start := v_today::timestamp AT TIME ZONE v_tz;
  v_day_end := (v_today + 1)::timestamp AT TIME ZONE v_tz;
  v_month_start := date_trunc('month', v_today)::date::timestamp AT TIME ZONE v_tz;

  SELECT coalesce(sum(current_balance), 0) INTO v_balance
    FROM financial_accounts
   WHERE company_id = _company_id AND status = 'active';

  WITH tx AS (
    SELECT t.type, t.status, coalesce(t.amount, 0) AS amount, t.paid_at,
           coalesce(t.due_date, t.transaction_date) AS ref_date,
           lower(coalesce(c.name, '')) AS cat
      FROM financial_transactions t
      LEFT JOIN financial_categories c ON c.id = t.category_id
     WHERE t.company_id = _company_id
       AND t.status <> 'cancelled'
  )
  SELECT
    coalesce(sum(amount) FILTER (WHERE type = 'income' AND status NOT IN ('paid', 'refunded')), 0) AS receivable,
    coalesce(sum(amount) FILTER (WHERE type = 'income' AND status NOT IN ('paid', 'refunded')
                                   AND (ref_date IS NULL OR ref_date < v_today)), 0) AS overdue,
    coalesce(sum(amount) FILTER (WHERE type = 'income' AND status NOT IN ('paid', 'refunded')
                                   AND ref_date >= v_today AND ref_date <= v_today + 30), 0) AS due30,
    coalesce(sum(amount) FILTER (WHERE type = 'income' AND status NOT IN ('paid', 'refunded')
                                   AND ref_date > v_today + 30), 0) AS due60,
    coalesce(sum(amount) FILTER (WHERE type = 'expense' AND status NOT IN ('paid', 'refunded')), 0) AS payable,
    coalesce(sum(amount) FILTER (WHERE type = 'income' AND status = 'paid'
                                   AND paid_at >= v_month_start AND paid_at < v_day_end), 0) AS gross,
    coalesce(sum(amount) FILTER (WHERE type = 'expense' AND status = 'paid'
                                   AND paid_at >= v_month_start AND paid_at < v_day_end), 0) AS month_expense,
    coalesce(sum(amount) FILTER (WHERE type = 'expense' AND status = 'paid'
                                   AND paid_at >= v_month_start AND paid_at < v_day_end
                                   AND (cat LIKE '%taxa%' OR cat LIKE '%estorno%'
                                        OR cat LIKE '%reembolso%' OR cat LIKE '%dedução%')), 0) AS taxes,
    coalesce(sum(amount) FILTER (WHERE type = 'income' AND status = 'paid'
                                   AND paid_at >= v_day_start AND paid_at < v_day_end), 0) AS receipts_today,
    count(*) FILTER (WHERE type = 'income' AND status = 'paid'
                       AND paid_at >= v_day_start AND paid_at < v_day_end) AS receipts_today_count,
    coalesce(sum(amount) FILTER (WHERE type = 'income' AND status = 'pending'), 0) AS pending,
    count(*) FILTER (WHERE type = 'income' AND status = 'pending') AS pending_count
  INTO v_agg
  FROM tx;

  SELECT coalesce(jsonb_agg(u ORDER BY u->>'date'), '[]'::jsonb) INTO v_upcoming_income
    FROM (
      SELECT jsonb_build_object('id', t.id, 'description', t.description,
                                'date', coalesce(t.due_date, t.transaction_date),
                                'amount', coalesce(t.amount, 0)) AS u
        FROM financial_transactions t
       WHERE t.company_id = _company_id AND t.type = 'income'
         AND t.status IN ('pending', 'overdue')
       ORDER BY coalesce(t.due_date, t.transaction_date)
       LIMIT 5
    ) s;

  SELECT coalesce(jsonb_agg(u ORDER BY u->>'date'), '[]'::jsonb) INTO v_upcoming_expense
    FROM (
      SELECT jsonb_build_object('id', t.id, 'description', t.description,
                                'date', coalesce(t.due_date, t.transaction_date),
                                'amount', coalesce(t.amount, 0)) AS u
        FROM financial_transactions t
       WHERE t.company_id = _company_id AND t.type = 'expense'
         AND t.status IN ('pending', 'overdue')
       ORDER BY coalesce(t.due_date, t.transaction_date)
       LIMIT 5
    ) s;

  RETURN jsonb_build_object(
    'current_balance', v_balance,
    'receivable', v_agg.receivable,
    'receivable_overdue', v_agg.overdue,
    'receivable_due30', v_agg.due30,
    'receivable_due60_plus', v_agg.due60,
    'payable', v_agg.payable,
    'gross_revenue', v_agg.gross,
    'month_expense', v_agg.month_expense,
    'taxes_and_deductions', v_agg.taxes,
    'receipts_today', v_agg.receipts_today,
    'receipts_today_count', v_agg.receipts_today_count,
    'pending_receivable', v_agg.pending,
    'pending_receivable_count', v_agg.pending_count,
    'upcoming_income', v_upcoming_income,
    'upcoming_expense', v_upcoming_expense
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finance_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_overview(uuid) TO authenticated, service_role;
