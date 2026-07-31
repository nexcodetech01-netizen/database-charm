-- Permite baixa + estorno vinculados ao mesmo lançamento (sentidos opostos),
-- mantendo a proteção contra duplicidade.
DROP INDEX IF EXISTS public.ux_cash_movements_transaction;
CREATE UNIQUE INDEX ux_cash_movements_transaction_type
  ON public.cash_movements (transaction_id, type)
  WHERE transaction_id IS NOT NULL;

-- 1) Motor de liquidação: grava transaction_id
CREATE OR REPLACE FUNCTION public.settle_financial_transaction(_transaction_id uuid, _payment_method text, _account_id uuid, _paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _notes text DEFAULT NULL::text)
 RETURNS financial_transactions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.financial_transactions;
  v_account public.financial_accounts;
  v_session public.cash_sessions;
  v_amount numeric;
  v_paid_at timestamptz;
BEGIN
  -- Timestamp real da liquidação. Nunca horário fixo.
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

  v_amount := COALESCE(v_tx.amount, 0);

  IF v_account.type = 'cash' THEN
    SELECT * INTO v_session
    FROM public.cash_sessions
    WHERE company_id = v_tx.company_id AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;

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
      COALESCE(NULLIF(btrim(COALESCE(_notes, '')), ''), v_tx.description),
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
      payment_method = _payment_method,
      account_id = _account_id,
      notes = COALESCE(NULLIF(btrim(COALESCE(_notes, '')), ''), notes),
      updated_at = now()
  WHERE id = _transaction_id
  RETURNING * INTO v_tx;

  RETURN v_tx;
END;
$function$;

-- 2) Estorno de baixa: grava transaction_id no movimento espelho
CREATE OR REPLACE FUNCTION public.reverse_financial_transaction(_transaction_id uuid, _notes text DEFAULT NULL::text)
 RETURNS financial_transactions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.financial_transactions;
  v_account public.financial_accounts;
  v_session public.cash_sessions;
  v_amount numeric;
  v_audit text;
BEGIN
  SELECT * INTO v_tx FROM public.financial_transactions WHERE id = _transaction_id FOR UPDATE;
  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Lançamento financeiro não encontrado.';
  END IF;
  IF v_tx.status <> 'paid' THEN
    RAISE EXCEPTION 'Apenas lançamentos liquidados podem ser estornados.';
  END IF;

  v_amount := COALESCE(v_tx.amount, 0);

  IF v_tx.account_id IS NOT NULL THEN
    SELECT * INTO v_account FROM public.financial_accounts WHERE id = v_tx.account_id;
  END IF;

  -- Espelha o movimento de caixa da liquidação (cash_in -> cash_out).
  IF v_account.id IS NOT NULL AND v_account.type = 'cash' THEN
    SELECT * INTO v_session
    FROM public.cash_sessions
    WHERE company_id = v_tx.company_id AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;

    IF v_session.id IS NULL THEN
      RAISE EXCEPTION 'CAIXA_FECHADO: não é possível estornar um recebimento em Caixa sem uma sessão de caixa aberta.';
    END IF;

    INSERT INTO public.cash_movements (session_id, company_id, type, amount, reason, note, created_by, transaction_id)
    VALUES (
      v_session.id,
      v_tx.company_id,
      CASE WHEN v_tx.type = 'income' THEN 'cash_out' ELSE 'cash_in' END,
      v_amount,
      'Estorno de baixa financeira',
      COALESCE(NULLIF(btrim(COALESCE(_notes, '')), ''), v_tx.description),
      auth.uid(),
      _transaction_id
    )
    ON CONFLICT (transaction_id, type) WHERE transaction_id IS NOT NULL DO NOTHING;
  END IF;

  -- Reversão exata da lógica de liquidação.
  IF v_account.id IS NOT NULL THEN
    UPDATE public.financial_accounts
    SET current_balance = COALESCE(current_balance, 0)
        - CASE WHEN v_tx.type = 'income' THEN v_amount ELSE -v_amount END,
        updated_at = now()
    WHERE id = v_account.id;
  END IF;

  v_audit := format(
    '[estorno %s] baixa original: %s | forma: %s | conta: %s | valor: %s',
    to_char(now(), 'YYYY-MM-DD HH24:MI'),
    COALESCE(to_char(v_tx.paid_at, 'YYYY-MM-DD HH24:MI'), '—'),
    COALESCE(v_tx.payment_method, '—'),
    COALESCE(v_account.name, '—'),
    to_char(v_amount, 'FM999999990.00')
  );
  IF NULLIF(btrim(COALESCE(_notes, '')), '') IS NOT NULL THEN
    v_audit := v_audit || ' | motivo: ' || btrim(_notes);
  END IF;

  UPDATE public.financial_transactions
  SET status = 'pending',
      paid_at = NULL,
      account_id = NULL,
      payment_method = NULL,
      settlement_session_id = NULL,
      notes = btrim(COALESCE(notes || E'\n', '') || v_audit),
      updated_at = now()
  WHERE id = _transaction_id
  RETURNING * INTO v_tx;

  RETURN v_tx;
END;
$function$;

-- 3) Cancelamento de venda: grava transaction_id no espelho de caixa
CREATE OR REPLACE FUNCTION public.reverse_sale_finance(_sale_id uuid, _reason text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale        public.sales%ROWTYPE;
  v_tx          public.financial_transactions%ROWTYPE;
  v_account     public.financial_accounts%ROWTYPE;
  v_session_id  uuid;
  v_amount      numeric;
  v_audit       text;
  v_note        text;
  v_count       integer := 0;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = _sale_id;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT cs.id INTO v_session_id
  FROM public.cash_sessions cs
  WHERE cs.id = v_sale.cash_session_id AND cs.status = 'open';

  IF v_session_id IS NULL THEN
    SELECT cs.id INTO v_session_id
    FROM public.cash_sessions cs
    WHERE cs.company_id = v_sale.company_id AND cs.status = 'open'
    ORDER BY cs.opened_at DESC
    LIMIT 1;
  END IF;

  FOR v_tx IN
    SELECT ft.*
    FROM public.financial_transactions ft
    WHERE ft.company_id = v_sale.company_id
      AND ft.status IN ('paid', 'pending', 'overdue')
      AND (
        ft.id = v_sale.finance_ref
        OR (ft.source = 'sale' AND ft.reference_id = v_sale.id)
        OR (ft.source = 'credit_payment' AND EXISTS (
              SELECT 1
              FROM public.credit_payments cp
              JOIN public.credit_accounts ca ON ca.id = cp.credit_account_id
              WHERE cp.id = ft.reference_id AND ca.sale_id = v_sale.id))
      )
    FOR UPDATE
  LOOP
    v_amount  := COALESCE(v_tx.amount, 0);
    v_account := NULL;
    IF v_tx.account_id IS NOT NULL THEN
      SELECT * INTO v_account FROM public.financial_accounts WHERE id = v_tx.account_id;
    END IF;

    IF v_tx.status = 'paid' THEN
      IF v_account.id IS NOT NULL AND v_account.type = 'cash' AND v_session_id IS NOT NULL AND v_amount > 0 THEN
        v_note := 'sale_id=' || v_sale.id::text || ' tx=' || v_tx.id::text;
        INSERT INTO public.cash_movements (session_id, company_id, type, amount, reason, note, created_by, transaction_id)
        SELECT v_session_id,
               v_tx.company_id,
               CASE WHEN v_tx.type = 'income' THEN 'cash_out' ELSE 'cash_in' END,
               v_amount,
               'sale_cancellation',
               v_note,
               auth.uid(),
               v_tx.id
        WHERE NOT EXISTS (
          SELECT 1 FROM public.cash_movements cm
          WHERE cm.company_id = v_tx.company_id
            AND cm.reason = 'sale_cancellation'
            AND cm.note = v_note
        )
        ON CONFLICT (transaction_id, type) WHERE transaction_id IS NOT NULL DO NOTHING;
      END IF;

      IF v_account.id IS NOT NULL THEN
        UPDATE public.financial_accounts
           SET current_balance = COALESCE(current_balance, 0)
                 - CASE WHEN v_tx.type = 'income' THEN v_amount ELSE -v_amount END,
               updated_at = now()
         WHERE id = v_account.id;
      END IF;
    END IF;

    v_audit := format(
      '[cancelamento de venda %s] estado anterior: %s | baixa original: %s | forma: %s | conta: %s | valor: %s',
      to_char(now(), 'YYYY-MM-DD HH24:MI'),
      v_tx.status,
      COALESCE(to_char(v_tx.paid_at, 'YYYY-MM-DD HH24:MI'), '—'),
      COALESCE(v_tx.payment_method, '—'),
      COALESCE(v_account.name, '—'),
      to_char(v_amount, 'FM999999990.00')
    );
    IF v_tx.status = 'paid' AND (v_account.id IS NULL OR v_account.type <> 'cash') THEN
      NULL;
    ELSIF v_tx.status = 'paid' AND v_session_id IS NULL THEN
      v_audit := v_audit || ' | sem sessão de caixa aberta: movimento de caixa não gerado';
    END IF;
    IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NOT NULL THEN
      v_audit := v_audit || ' | motivo: ' || btrim(_reason);
    END IF;

    UPDATE public.financial_transactions
       SET status = 'refunded',
           paid_at = NULL,
           account_id = NULL,
           payment_method = NULL,
           settlement_session_id = NULL,
           notes = btrim(COALESCE(notes || E'\n', '') || v_audit),
           updated_at = now()
     WHERE id = v_tx.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- 4) Saneamento: mantém compatibilidade com o novo índice
CREATE OR REPLACE FUNCTION public.complete_settlement_data(_transaction_id uuid, _payment_method text, _account_id uuid, _notes text DEFAULT NULL::text)
 RETURNS financial_transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.financial_transactions;
  v_account public.financial_accounts;
  v_session public.cash_sessions;
  v_amount numeric;
  v_needs_booking boolean;
  v_already_booked boolean;
BEGIN
  SELECT * INTO v_tx
  FROM public.financial_transactions
  WHERE id = _transaction_id
  FOR UPDATE;

  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Lançamento financeiro não encontrado.';
  END IF;
  IF v_tx.status <> 'paid' THEN
    RAISE EXCEPTION 'Este saneamento aplica-se apenas a lançamentos já baixados.';
  END IF;
  IF v_tx.payment_method IS NOT NULL AND v_tx.account_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este lançamento já está completo.';
  END IF;

  SELECT * INTO v_account FROM public.financial_accounts WHERE id = _account_id;
  IF v_account.id IS NULL OR v_account.company_id <> v_tx.company_id THEN
    RAISE EXCEPTION 'Conta de destino inválida.';
  END IF;

  v_amount := COALESCE(v_tx.amount, 0);

  SELECT EXISTS (
    SELECT 1 FROM public.cash_movements WHERE transaction_id = _transaction_id
  ) INTO v_already_booked;

  v_needs_booking := v_tx.account_id IS NULL AND NOT v_already_booked;

  IF v_needs_booking AND v_account.type = 'cash' THEN
    SELECT * INTO v_session
    FROM public.cash_sessions
    WHERE company_id = v_tx.company_id AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;

    IF v_session.id IS NULL THEN
      RAISE EXCEPTION 'CAIXA_FECHADO: não é possível regularizar em Caixa sem uma sessão de caixa aberta. Abra o caixa antes de confirmar.';
    END IF;

    INSERT INTO public.cash_movements (session_id, company_id, type, amount, reason, note, created_by, transaction_id)
    VALUES (
      v_session.id,
      v_tx.company_id,
      CASE WHEN v_tx.type = 'income' THEN 'cash_in' ELSE 'cash_out' END,
      v_amount,
      'Saneamento de baixa',
      COALESCE(NULLIF(btrim(COALESCE(_notes, '')), ''), v_tx.description),
      auth.uid(),
      _transaction_id
    )
    ON CONFLICT (transaction_id, type) WHERE transaction_id IS NOT NULL DO NOTHING;

    IF NOT FOUND THEN
      v_needs_booking := false;
    END IF;
  END IF;

  IF v_needs_booking THEN
    PERFORM 1 FROM public.financial_accounts WHERE id = _account_id FOR UPDATE;

    UPDATE public.financial_accounts
    SET current_balance = COALESCE(current_balance, 0)
        + CASE WHEN v_tx.type = 'income' THEN v_amount ELSE -v_amount END,
        updated_at = now()
    WHERE id = _account_id;
  END IF;

  UPDATE public.financial_transactions
  SET payment_method = COALESCE(payment_method, _payment_method),
      account_id = COALESCE(account_id, _account_id),
      notes = COALESCE(NULLIF(btrim(COALESCE(_notes, '')), ''), notes),
      updated_at = now()
  WHERE id = _transaction_id
  RETURNING * INTO v_tx;

  RETURN v_tx;
END;
$function$;