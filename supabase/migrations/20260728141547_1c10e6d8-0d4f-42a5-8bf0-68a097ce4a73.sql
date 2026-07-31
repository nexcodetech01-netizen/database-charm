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
  v_sale public.sales%ROWTYPE;
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

  -- FIN-SYNC — Sincroniza sales.status quando o recebível é da venda.
  -- Reutiliza o canal oficial (UPDATE sales SET status='paid'), que passa
  -- pelos guards existentes (enforce_sale_paid_requires_settlement +
  -- apply_sale_to_finance) sem duplicar lógica de negócio. Só sincroniza
  -- vendas que ainda estão pendentes/parcialmente pagas (nunca reabre
  -- vendas canceladas nem sobrescreve outra baixa).
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

  RETURN v_tx;
END;
$function$;

-- Saneamento pontual: sincroniza vendas cuja baixa oficial já ocorreu mas
-- ficaram com sales.status = 'pending' por causa da regressão. Só toca
-- vendas com título 'paid' completo (payment_method + account_id + paid_at)
-- e sem crediário associado, respeitando integralmente os guards atuais.
UPDATE public.sales s
SET status = 'paid',
    paid_at = COALESCE(s.paid_at, ft.paid_at)
FROM public.financial_transactions ft
WHERE ft.source = 'sale'
  AND ft.reference_id = s.id
  AND ft.status = 'paid'
  AND ft.payment_method IS NOT NULL
  AND ft.account_id IS NOT NULL
  AND ft.paid_at IS NOT NULL
  AND s.status IN ('pending', 'partially_paid')
  AND NOT EXISTS (SELECT 1 FROM public.credit_accounts ca WHERE ca.sale_id = s.id);