-- =====================================================================
-- Correção do "A receber" em dobro (08/10/2026)
--
-- 1) Toda venda no crediário tem, além da parcela, um título espelho no
--    Financeiro ("Venda Nº … — Saldo do crediário", source
--    'credit_payment', reference_id = id da parcela). finance_overview e
--    daily_finance_summary somavam os dois. Agora o espelho fica de fora
--    (a parcela é a fonte da verdade). Nada é apagado nem alterado.
-- 2) Cancelar uma venda agora cancela também o crediário dela (conta,
--    parcelas em aberto e o título espelho pendente). Pagamentos já
--    recebidos NÃO são mexidos (estorno continua sendo à parte).
-- =====================================================================

-- 1a) finance_overview
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
  v_credit record;
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

  -- Crediário: parcelas em aberto (o crediário é a fonte da verdade).
  SELECT coalesce(sum(i.amount - coalesce(i.paid_amount, 0)), 0) AS total,
         coalesce(sum(i.amount - coalesce(i.paid_amount, 0))
                  FILTER (WHERE i.due_date IS NULL OR i.due_date < v_today), 0) AS overdue,
         coalesce(sum(i.amount - coalesce(i.paid_amount, 0))
                  FILTER (WHERE i.due_date >= v_today AND i.due_date <= v_today + 30), 0) AS due30,
         coalesce(sum(i.amount - coalesce(i.paid_amount, 0))
                  FILTER (WHERE i.due_date > v_today + 30), 0) AS due60,
         count(*) AS cnt
    INTO v_credit
    FROM credit_installments i
    JOIN credit_accounts a ON a.id = i.credit_account_id
   WHERE i.company_id = _company_id
     AND i.status IN ('pending', 'partially_paid')
     AND a.status NOT IN ('cancelled', 'settled');

  WITH tx AS (
    SELECT t.type, t.status, coalesce(t.amount, 0) AS amount, t.paid_at,
           coalesce(t.due_date, t.transaction_date) AS ref_date,
           lower(coalesce(c.name, '')) AS cat,
           (t.source = 'sale') AS is_sale,
           -- Título de venda que é de crediário: duplicado (o crediário conta).
           ((t.source = 'sale' AND EXISTS (
              SELECT 1 FROM credit_accounts a
               WHERE a.sale_id = t.reference_id AND a.status <> 'cancelled'))
            -- "Saldo do crediário" (espelho da parcela): a parcela já conta.
            OR (t.source = 'credit_payment' AND EXISTS (SELECT 1 FROM credit_installments ci WHERE ci.id = t.reference_id))) AS credit_dup
      FROM financial_transactions t
      LEFT JOIN financial_categories c ON c.id = t.category_id
     WHERE t.company_id = _company_id
       AND t.status <> 'cancelled'
  )
  SELECT
    coalesce(sum(amount) FILTER (WHERE type = 'income' AND NOT credit_dup AND status NOT IN ('paid', 'refunded')), 0) AS receivable,
    coalesce(sum(amount) FILTER (WHERE type = 'income' AND NOT credit_dup AND status NOT IN ('paid', 'refunded')
                                   AND (ref_date IS NULL OR ref_date < v_today)), 0) AS overdue,
    coalesce(sum(amount) FILTER (WHERE type = 'income' AND NOT credit_dup AND status NOT IN ('paid', 'refunded')
                                   AND ref_date >= v_today AND ref_date <= v_today + 30), 0) AS due30,
    coalesce(sum(amount) FILTER (WHERE type = 'income' AND NOT credit_dup AND status NOT IN ('paid', 'refunded')
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
    coalesce(sum(amount) FILTER (WHERE type = 'income' AND NOT credit_dup AND status = 'pending'), 0) AS pending,
    count(*) FILTER (WHERE type = 'income' AND NOT credit_dup AND status = 'pending') AS pending_count,
    coalesce(sum(amount) FILTER (WHERE type = 'income' AND is_sale AND NOT credit_dup
                                   AND status NOT IN ('paid', 'refunded')), 0) AS receivable_sales
  INTO v_agg
  FROM tx;

  SELECT coalesce(jsonb_agg(u ORDER BY u->>'date'), '[]'::jsonb) INTO v_upcoming_income
    FROM (
      SELECT u FROM (
        SELECT jsonb_build_object('id', t.id, 'description', t.description,
                                  'date', coalesce(t.due_date, t.transaction_date),
                                  'amount', coalesce(t.amount, 0)) AS u,
               coalesce(t.due_date, t.transaction_date) AS d
          FROM financial_transactions t
         WHERE t.company_id = _company_id AND t.type = 'income'
           AND t.status IN ('pending', 'overdue')
           AND NOT (t.source = 'sale' AND EXISTS (
                 SELECT 1 FROM credit_accounts a WHERE a.sale_id = t.reference_id AND a.status <> 'cancelled'))
           AND NOT (t.source = 'credit_payment' AND EXISTS (SELECT 1 FROM credit_installments ci WHERE ci.id = t.reference_id))
        UNION ALL
        SELECT jsonb_build_object('id', i.id,
                                  'description', 'Crediário · ' || coalesce(cu.name, 'cliente')
                                                 || ' · ' || i.sequence || 'ª parcela',
                                  'date', i.due_date,
                                  'amount', i.amount - coalesce(i.paid_amount, 0)) AS u,
               i.due_date AS d
          FROM credit_installments i
          JOIN credit_accounts a ON a.id = i.credit_account_id
          LEFT JOIN customers cu ON cu.id = a.customer_id
         WHERE i.company_id = _company_id
           AND i.status IN ('pending', 'partially_paid')
           AND a.status NOT IN ('cancelled', 'settled')
      ) all_income
      ORDER BY d NULLS FIRST
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
    'receivable', v_agg.receivable + v_credit.total,
    'receivable_overdue', v_agg.overdue + v_credit.overdue,
    'receivable_due30', v_agg.due30 + v_credit.due30,
    'receivable_due60_plus', v_agg.due60 + v_credit.due60,
    'receivable_sales', v_agg.receivable_sales + v_credit.total,
    'receivable_credit', v_credit.total,
    'payable', v_agg.payable,
    'gross_revenue', v_agg.gross,
    'month_expense', v_agg.month_expense,
    'taxes_and_deductions', v_agg.taxes,
    'receipts_today', v_agg.receipts_today,
    'receipts_today_count', v_agg.receipts_today_count,
    'pending_receivable', v_agg.pending + v_credit.total,
    'pending_receivable_count', v_agg.pending_count + v_credit.cnt,
    'upcoming_income', v_upcoming_income,
    'upcoming_expense', v_upcoming_expense
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finance_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_overview(uuid) TO authenticated, service_role;

-- 1b) daily_finance_summary
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
       -- "Saldo do crediário" (espelho da parcela): a parcela já entra abaixo.
       AND NOT (t.source = 'credit_payment' AND EXISTS (SELECT 1 FROM credit_installments ci WHERE ci.id = t.reference_id))
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


-- ---------------------------------------------------------------------
-- 2) Venda cancelada → crediário cancelado
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_cancel_credit_on_sale_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_account record;
BEGIN
  FOR v_account IN
    SELECT id FROM public.credit_accounts
     WHERE sale_id = NEW.id AND status NOT IN ('cancelled', 'settled')
  LOOP
    UPDATE public.financial_transactions t
       SET status = 'cancelled',
           notes = btrim(coalesce(t.notes || E'\n', '') ||
                   '[venda cancelada] saldo do crediário cancelado junto com a venda.'),
           updated_at = now()
     WHERE t.source = 'credit_payment'
       AND t.status IN ('pending', 'overdue')
       AND t.reference_id IN (SELECT i.id FROM public.credit_installments i
                               WHERE i.credit_account_id = v_account.id);

    UPDATE public.credit_installments
       SET status = 'cancelled', updated_at = now()
     WHERE credit_account_id = v_account.id
       AND status IN ('pending', 'partially_paid');

    UPDATE public.credit_accounts
       SET status = 'cancelled', cancelled_at = now(), updated_at = now()
     WHERE id = v_account.id;
  END LOOP;
  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trg_cancel_credit_on_sale_cancel() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cancel_credit_on_sale_cancel ON public.sales;
CREATE TRIGGER trg_cancel_credit_on_sale_cancel
  AFTER UPDATE OF status ON public.sales
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION public.trg_cancel_credit_on_sale_cancel();
