-- HOTFIX-002 (parte 2) — Isolamento de caixa em baixas financeiras.
--
-- Bug: quando dois operadores estão com sessão de caixa aberta ao mesmo
-- tempo na mesma empresa, settle_financial_transaction() sempre escolhia
-- a sessão aberta MAIS RECENTEMENTE (ORDER BY opened_at DESC LIMIT 1),
-- ignorando quem de fato está fazendo a baixa. Além disso, o lançamento
-- em financial_transactions nunca gravava settlement_session_id, forçando
-- a view/consulta de resumo a usar um fallback ambíguo por janela de
-- tempo (paid_at entre opened_at/closed_at), que também podia casar com
-- mais de uma sessão aberta simultaneamente.
--
-- Fix:
--   1. Prioriza a sessão de caixa aberta do PRÓPRIO operador que está
--      executando a baixa (created_by = auth.uid()); só cai no fallback
--      "mais recente da empresa" se o operador não tiver nenhuma sessão
--      aberta em seu nome (preserva o comportamento anterior como rede
--      de segurança, não quebra nenhum fluxo existente).
--   2. Grava settlement_session_id em financial_transactions no momento
--      da baixa, eliminando a necessidade do fallback ambíguo para toda
--      baixa nova a partir de agora.

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
    WHERE company_id = v_tx.company_id AND status = 'open' AND created_by = auth.uid()
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

  RETURN v_tx;
END;
$function$;
