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
  v_effective_account_id uuid;
  v_reconstruct_only boolean;
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

  SELECT EXISTS (
    SELECT 1 FROM public.cash_movements WHERE transaction_id = _transaction_id
  ) INTO v_already_booked;

  -- Cenário A: dados completos, apenas o cash_movement está ausente → reconstruir só o movimento.
  -- Cenário B: falta payment_method ou account_id → fluxo original de completar dados.
  v_reconstruct_only := (v_tx.payment_method IS NOT NULL AND v_tx.account_id IS NOT NULL);

  IF v_reconstruct_only AND v_already_booked THEN
    RAISE EXCEPTION 'Este lançamento já está completo.';
  END IF;

  -- Conta efetiva: no Cenário A, prevalece a conta já registrada no lançamento;
  -- no Cenário B, exige-se a conta informada.
  v_effective_account_id := CASE
    WHEN v_reconstruct_only THEN v_tx.account_id
    ELSE _account_id
  END;

  SELECT * INTO v_account FROM public.financial_accounts WHERE id = v_effective_account_id;
  IF v_account.id IS NULL OR v_account.company_id <> v_tx.company_id THEN
    RAISE EXCEPTION 'Conta de destino inválida.';
  END IF;

  v_amount := COALESCE(v_tx.amount, 0);

  -- Precisamos gerar cash_movement quando ele ainda não existe.
  v_needs_booking := NOT v_already_booked;

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

  -- Ajuste de saldo aplica-se apenas quando o lançamento ainda não estava vinculado a uma conta.
  -- No Cenário A o saldo já foi movimentado no momento original da baixa, portanto NÃO é reajustado.
  IF v_needs_booking AND NOT v_reconstruct_only AND v_tx.account_id IS NULL THEN
    PERFORM 1 FROM public.financial_accounts WHERE id = v_effective_account_id FOR UPDATE;

    UPDATE public.financial_accounts
    SET current_balance = COALESCE(current_balance, 0)
        + CASE WHEN v_tx.type = 'income' THEN v_amount ELSE -v_amount END,
        updated_at = now()
    WHERE id = v_effective_account_id;
  END IF;

  -- Cenário A: NÃO altera financial_transactions (dados já estão completos).
  -- Cenário B: preenche os campos ausentes via COALESCE (comportamento original).
  IF v_reconstruct_only THEN
    RETURN v_tx;
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