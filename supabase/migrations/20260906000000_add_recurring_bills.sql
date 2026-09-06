-- Contas recorrentes (2026-09-06)
--
-- Adiciona a opção de marcar um lançamento (ex.: DAS pago todo dia 20)
-- como recorrente. Quando esse lançamento é baixado (pago), o sistema
-- cria automaticamente o próximo lançamento do mês seguinte, já
-- pendente, com o mesmo valor/descrição/categoria/conta — sem precisar
-- cadastrar tudo de novo manualmente todo mês.
--
-- Implementação deliberadamente simples: sem cron/job agendado. A
-- geração do próximo lançamento acontece no momento da baixa (dentro
-- de settle_financial_transaction), então não depende de nenhum
-- processo rodando em segundo plano.

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_day smallint
    CHECK (recurrence_day IS NULL OR (recurrence_day BETWEEN 1 AND 28)),
  ADD COLUMN IF NOT EXISTS recurring_parent_id uuid
    REFERENCES public.financial_transactions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.financial_transactions.recurring_parent_id IS
  'Aponta para o lançamento recorrente original, pra rastrear a cadeia de meses gerados e evitar duplicar o mesmo mês duas vezes.';

CREATE INDEX IF NOT EXISTS idx_financial_transactions_recurring_parent
  ON public.financial_transactions(recurring_parent_id)
  WHERE recurring_parent_id IS NOT NULL;

COMMENT ON COLUMN public.financial_transactions.is_recurring IS
  'Se true, ao baixar (pagar) este lançamento, o sistema cria automaticamente o próximo mês.';
COMMENT ON COLUMN public.financial_transactions.recurrence_day IS
  'Dia do mês (1-28, evita problemas com meses de 28/29/30/31 dias) em que o próximo lançamento vence.';

-- Reescreve settle_financial_transaction: cópia EXATA da versão de
-- 20260827230000 (fix_settle_financial_transaction_column), só com o
-- bloco de geração de recorrência adicionado no final, antes do
-- RETURN. Nada do comportamento existente foi alterado.
CREATE OR REPLACE FUNCTION public.settle_financial_transaction(
  _transaction_id uuid,
  _payment_method text,
  _account_id uuid,
  _paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _notes text DEFAULT NULL::text,
  _settled_amount numeric DEFAULT NULL::numeric
)
 RETURNS financial_transactions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.financial_transactions;
  v_account public.financial_accounts;
  v_session public.cash_sessions;
  v_original numeric;
  v_amount numeric;
  v_discount numeric;
  v_paid_at timestamptz;
  v_sale public.sales%ROWTYPE;
  v_notes text;
  v_installment public.credit_installments%ROWTYPE;
  v_credit_account public.credit_accounts%ROWTYPE;
  v_new_balance numeric;
  v_next_due date;
BEGIN
  v_paid_at := COALESCE(_paid_at, now());

  SELECT * INTO v_tx FROM public.financial_transactions WHERE id = _transaction_id;
  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Lançamento financeiro não encontrado.';
  END IF;
  IF v_tx.status = 'paid' THEN
    RAISE EXCEPTION 'Este lançamento já está baixado.';
  END IF;

  SELECT * INTO v_account FROM public.financial_accounts WHERE id = _account_id;
  IF v_account.id IS NULL OR v_account.company_id <> v_tx.company_id THEN
    RAISE EXCEPTION 'Conta de destino inválida.';
  END IF;

  v_original := COALESCE(v_tx.amount, 0);
  v_amount := ROUND(COALESCE(_settled_amount, v_original), 2);

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'VALOR_INVALIDO: o valor liquidado deve ser maior que zero.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_amount > v_original * 2 THEN
    RAISE EXCEPTION 'VALOR_INVALIDO: o valor liquidado não pode exceder o dobro do valor original.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_discount := ROUND(v_original - v_amount, 2);

  v_notes := NULLIF(btrim(COALESCE(_notes, '')), '');
  IF v_discount <> 0 THEN
    v_notes := btrim(
      COALESCE(v_notes || ' · ', '') ||
      CASE WHEN v_discount > 0
        THEN 'Desconto concedido na baixa: ' || to_char(v_discount, 'FM999999990.00')
        ELSE 'Acréscimo cobrado na baixa: ' || to_char(-v_discount, 'FM999999990.00')
      END ||
      ' (valor original ' || to_char(v_original, 'FM999999990.00') || ')'
    );
  END IF;

  IF v_account.type = 'cash' THEN
    SELECT * INTO v_session
    FROM public.cash_sessions
    WHERE company_id = v_tx.company_id AND status = 'open' AND operator_id = auth.uid()
    ORDER BY opened_at DESC
    LIMIT 1;

    IF v_session.id IS NULL THEN
      SELECT * INTO v_session
      FROM public.cash_sessions
      WHERE company_id = v_tx.company_id AND status = 'open'
      ORDER BY opened_at DESC
      LIMIT 1;
    END IF;

    IF v_session.id IS NULL THEN
      RAISE EXCEPTION 'CAIXA_FECHADO: não é possível receber em Caixa sem uma sessão de caixa aberta. Abra o caixa antes de registrar a baixa.';
    END IF;

    INSERT INTO public.cash_movements (session_id, company_id, type, amount, reason, note, created_by, transaction_id)
    VALUES (
      v_session.id,
      v_tx.company_id,
      CASE WHEN v_tx.type = 'income' THEN 'cash_in' ELSE 'cash_out' END,
      v_amount,
      'Baixa financeira',
      COALESCE(v_notes, v_tx.description),
      auth.uid(),
      _transaction_id
    );
  END IF;

  UPDATE public.financial_accounts
  SET current_balance = COALESCE(current_balance, 0)
      + CASE WHEN v_tx.type = 'income' THEN v_amount ELSE -v_amount END,
      updated_at = now()
  WHERE id = _account_id;

  UPDATE public.financial_transactions
  SET status = 'paid',
      paid_at = v_paid_at,
      amount = v_amount,
      discount_amount = v_discount,
      payment_method = _payment_method,
      account_id = _account_id,
      notes = COALESCE(v_notes, notes),
      settlement_session_id = v_session.id,
      updated_at = now()
  WHERE id = _transaction_id
  RETURNING * INTO v_tx;

  IF v_tx.source = 'sale' AND v_tx.reference_id IS NOT NULL THEN
    SELECT * INTO v_sale FROM public.sales WHERE id = v_tx.reference_id;
    IF v_sale.id IS NOT NULL
       AND v_sale.status IN ('pending', 'partially_paid')
       AND NOT EXISTS (SELECT 1 FROM public.credit_accounts WHERE sale_id = v_sale.id)
    THEN
      UPDATE public.sales
      SET status = 'paid',
          paid_at = v_paid_at
      WHERE id = v_sale.id;
    END IF;
  END IF;

  IF v_tx.source = 'credit_payment' AND v_tx.reference_id IS NOT NULL THEN
    SELECT * INTO v_installment FROM public.credit_installments WHERE id = v_tx.reference_id FOR UPDATE;
    IF v_installment.id IS NOT NULL THEN
      UPDATE public.credit_installments
         SET paid_amount = amount,
             status = 'paid',
             paid_at = v_paid_at,
             updated_at = now()
       WHERE id = v_installment.id;

      SELECT * INTO v_credit_account FROM public.credit_accounts WHERE id = v_installment.credit_account_id FOR UPDATE;
      IF v_credit_account.id IS NOT NULL THEN
        v_new_balance := GREATEST(v_credit_account.balance - v_amount, 0);
        UPDATE public.credit_accounts
           SET balance = v_new_balance,
               status = CASE WHEN v_new_balance = 0 THEN 'settled' ELSE 'partially_paid' END,
               settled_at = CASE WHEN v_new_balance = 0 THEN v_paid_at ELSE NULL END,
               updated_at = now()
         WHERE id = v_credit_account.id;

        UPDATE public.sales
           SET status = CASE WHEN v_new_balance = 0 THEN 'paid' ELSE 'partially_paid' END,
               paid_at = CASE WHEN v_new_balance = 0 THEN v_paid_at ELSE paid_at END,
               updated_at = now()
         WHERE id = v_credit_account.sale_id;
      END IF;
    END IF;
  END IF;

  -- NOVO (2026-09-06) — Contas recorrentes: se este lançamento estava
  -- marcado como recorrente, cria automaticamente o próximo mês, já
  -- pendente. Protegido contra duplicidade: só cria se ainda não
  -- existir um lançamento "filho" desse mesmo lançamento-origem para
  -- o próximo vencimento calculado (evita duplicar caso a função seja
  -- chamada mais de uma vez, ou se o usuário já tiver criado manual).
  IF v_tx.is_recurring AND v_tx.recurrence_day IS NOT NULL THEN
    v_next_due := (date_trunc('month', COALESCE(v_tx.due_date, v_tx.transaction_date)) + interval '1 month')::date
                  + (v_tx.recurrence_day - 1);

    IF NOT EXISTS (
      SELECT 1 FROM public.financial_transactions
      WHERE company_id = v_tx.company_id
        AND recurring_parent_id = COALESCE(v_tx.recurring_parent_id, v_tx.id)
        AND due_date = v_next_due
    ) THEN
      INSERT INTO public.financial_transactions (
        company_id, account_id, category_id, cost_center_id,
        type, description, amount, transaction_date, due_date,
        status, source, notes, is_recurring, recurrence_day,
        recurring_parent_id, created_by
      ) VALUES (
        v_tx.company_id, v_tx.account_id, v_tx.category_id, v_tx.cost_center_id,
        v_tx.type, v_tx.description, v_original, v_next_due, v_next_due,
        'pending', 'manual', 'Gerado automaticamente (conta recorrente)',
        true, v_tx.recurrence_day,
        COALESCE(v_tx.recurring_parent_id, v_tx.id), v_tx.created_by
      );
    END IF;
  END IF;

  RETURN v_tx;
END;
$function$;
