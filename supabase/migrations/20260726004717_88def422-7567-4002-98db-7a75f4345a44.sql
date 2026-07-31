ALTER TABLE public.cash_movements
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cash_movements_transaction
ON public.cash_movements(transaction_id)
WHERE transaction_id IS NOT NULL;

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
  -- 1. Lock da linha do lançamento (serializa chamadas concorrentes)
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

  -- Só lança saldo/caixa quando a baixa antiga não tinha conta definida
  -- e ainda não existe movimento de caixa vinculado a este lançamento.
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
    ON CONFLICT (transaction_id) WHERE transaction_id IS NOT NULL DO NOTHING;

    IF NOT FOUND THEN
      v_needs_booking := false;
    END IF;
  END IF;

  IF v_needs_booking THEN
    -- 2. Lock da conta de destino antes de mover saldo
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