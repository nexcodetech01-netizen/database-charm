-- NEXOS ENTERPRISE: Liberação de Baixa Financeira para Vendas com Crediário
-- Objetivo: Permitir que o operador liquide títulos no Financeiro mesmo se originados em crediário.

-- 1) Ajuste na função ensure_sale_receivable para remover o bloqueio de crediário
CREATE OR REPLACE FUNCTION public.ensure_sale_receivable(_sale_id uuid)
RETURNS public.financial_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_tx public.financial_transactions;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.user_has_company_access(v_sale.company_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para operar esta venda.' USING ERRCODE = '42501';
  END IF;

  IF v_sale.status IN ('cancelled', 'draft') THEN
    RAISE EXCEPTION 'Venda em rascunho ou cancelada não gera recebível.' USING ERRCODE = 'check_violation';
  END IF;

  -- BLOQUEIO REMOVIDO: Agora permitimos gerar o título mesmo se houver credit_account.
  -- O Financeiro passa a ser uma via válida de recebimento.

  -- Título em aberto já existente
  SELECT * INTO v_tx
    FROM public.financial_transactions
   WHERE source = 'sale' AND reference_id = _sale_id
     AND status NOT IN ('paid', 'cancelled', 'refunded')
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_tx.id IS NOT NULL THEN
    RETURN v_tx;
  END IF;

  -- Já baixado: devolve o título pago
  SELECT * INTO v_tx
    FROM public.financial_transactions
   WHERE source = 'sale' AND reference_id = _sale_id AND status = 'paid'
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_tx.id IS NOT NULL THEN
    RETURN v_tx;
  END IF;

  INSERT INTO public.financial_transactions(
    company_id, type, description, amount,
    transaction_date, due_date, status,
    source, reference_id, reference_number, created_by
  ) VALUES (
    v_sale.company_id, 'income',
    'Venda Nº ' || COALESCE(v_sale.number, v_sale.id::text),
    COALESCE(v_sale.grand_total, 0),
    COALESCE(v_sale.sale_date, CURRENT_DATE),
    COALESCE(v_sale.due_date, v_sale.sale_date, CURRENT_DATE),
    'pending',
    'sale', v_sale.id, v_sale.number,
    COALESCE(v_sale.created_by, auth.uid())
  )
  RETURNING * INTO v_tx;

  UPDATE public.sales SET finance_ref = v_tx.id
   WHERE id = _sale_id AND finance_ref IS DISTINCT FROM v_tx.id;

  RETURN v_tx;
END;
$function$;

-- 2) Ajuste na RPC de baixa financeira para sincronizar com a venda MESMO SE houver crediário.
-- Isso garante que a venda mude para 'paid' quando o título do Financeiro for baixado.
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
  
  v_discount := ROUND(v_original - v_amount, 2);
  v_notes := NULLIF(btrim(COALESCE(_notes, '')), '');

  IF v_account.type = 'cash' THEN
    SELECT * INTO v_session
    FROM public.cash_sessions
    WHERE company_id = v_tx.company_id AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;

    IF v_session.id IS NULL THEN
      RAISE EXCEPTION 'CAIXA_FECHADO: abra o caixa antes de registrar a baixa.';
    END IF;

    INSERT INTO public.cash_movements (session_id, company_id, type, amount, reason, note, created_by, transaction_id)
    VALUES (v_session.id, v_tx.company_id, CASE WHEN v_tx.type = 'income' THEN 'cash_in' ELSE 'cash_out' END, v_amount, 'Baixa financeira', COALESCE(v_notes, v_tx.description), auth.uid(), _transaction_id);
  END IF;

  UPDATE public.financial_accounts
  SET current_balance = COALESCE(current_balance, 0) + CASE WHEN v_tx.type = 'income' THEN v_amount ELSE -v_amount END,
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
      updated_at = now()
  WHERE id = _transaction_id
  RETURNING * INTO v_tx;

  -- FIN-SYNC: Sincroniza sales.status. 
  -- REMOVIDA A TRAVA 'NOT EXISTS credit_accounts' para permitir que a baixa no financeiro finalize a venda.
  IF v_tx.source = 'sale' AND v_tx.reference_id IS NOT NULL THEN
    SELECT * INTO v_sale FROM public.sales WHERE id = v_tx.reference_id;
    IF v_sale.id IS NOT NULL AND v_sale.status IN ('pending', 'partially_paid') THEN
      UPDATE public.sales
      SET status = 'paid',
          paid_at = v_paid_at,
          payment_method = COALESCE(payment_method, _payment_method)
      WHERE id = v_sale.id;
    END IF;
  END IF;

  RETURN v_tx;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ensure_sale_receivable(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_financial_transaction(uuid, text, uuid, timestamptz, text, numeric) TO authenticated, service_role;
