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
  v_was_paid boolean;
BEGIN
  SELECT * INTO v_tx FROM public.financial_transactions WHERE id = _transaction_id FOR UPDATE;
  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Lançamento financeiro não encontrado.';
  END IF;

  v_was_paid := (v_tx.paid_at IS NOT NULL);

  IF v_tx.status NOT IN ('paid', 'pending', 'overdue') THEN
    RAISE EXCEPTION 'Lançamento não pode ser estornado no status atual (%).', v_tx.status;
  END IF;

  IF v_tx.status <> 'paid' AND v_was_paid THEN
    RAISE EXCEPTION 'Apenas lançamentos liquidados podem ser estornados.';
  END IF;

  v_amount := COALESCE(v_tx.amount, 0);

  IF v_was_paid AND v_tx.account_id IS NOT NULL THEN
    SELECT * INTO v_account FROM public.financial_accounts WHERE id = v_tx.account_id;
  END IF;

  -- Espelha o movimento de caixa da liquidação (cash_in -> cash_out) somente se houve liquidação.
  IF v_was_paid AND v_account.id IS NOT NULL AND v_account.type = 'cash' THEN
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

  -- Reversão exata da lógica de liquidação (só quando houve liquidação).
  IF v_was_paid AND v_account.id IS NOT NULL THEN
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

  IF v_was_paid THEN
    -- Estorno de liquidação: retorna ao estado em aberto (comportamento preservado).
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
  ELSE
    -- Cancelamento de lançamento nunca liquidado (ex.: duplicidade): encerra definitivamente.
    UPDATE public.financial_transactions
    SET status = 'cancelled',
        paid_at = NULL,
        notes = btrim(COALESCE(notes || E'\n', '') || v_audit),
        updated_at = now()
    WHERE id = _transaction_id
    RETURNING * INTO v_tx;
  END IF;

  RETURN v_tx;
END;
$function$;