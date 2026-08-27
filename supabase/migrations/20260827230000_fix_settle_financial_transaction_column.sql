-- FIX — settle_financial_transaction quebrada: coluna errada em cash_sessions
-- (2026-08-27)
--
-- A correção de isolamento de sessão de caixa (20260826020000, "TERCEIRA
-- PARTE DA CORREÇÃO") introduziu uma consulta em cash_sessions usando a
-- coluna `created_by`, que não existe nessa tabela — o Postgres confirma
-- via hint: existe `operator_id`, não `created_by` (erro 42703). Resultado:
-- TODA baixa via Caixa (dinheiro, Pix próprio, débito) vinha falhando
-- desde essa migration.
--
-- Correção: troca `created_by` por `operator_id` (coluna real, já usada em
-- todo o resto do sistema para identificar o dono da sessão de caixa).
-- Resto da função é cópia EXATA da versão de 20260826020000 — nada mais
-- foi alterado.

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
    -- Prioridade 1: sessão aberta do próprio operador que está baixando.
    SELECT * INTO v_session
    FROM public.cash_sessions
    WHERE company_id = v_tx.company_id AND status = 'open' AND operator_id = auth.uid()
    ORDER BY opened_at DESC
    LIMIT 1;

    -- Fallback: nenhuma sessão própria aberta — usa a mais recente da
    -- empresa (comportamento anterior, preservado como rede de segurança).
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

  -- FIN-SYNC — Sincroniza sales.status quando o recebível é da venda.
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

  -- FIN-SYNC 2 (2026-08-26) — Sincroniza o Crediário quando o
  -- lançamento liquidado aqui é o de "saldo do crediário" (criado em
  -- `create_credit_sale` só pra dar visibilidade em "A Receber").
  -- Sem isso, receber DIRETO pelo Financeiro (em vez de pela tela de
  -- Crediário) marcaria esse lançamento como pago, mas o Crediário
  -- continuaria mostrando a parcela como pendente pra sempre —
  -- exatamente o problema inverso do que já corrigimos.
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

  RETURN v_tx;
END;
$function$;
