-- =====================================================================
-- Motor único de reversão financeira de cancelamento de venda.
--
-- Estado terminal ÚNICO escolhido: 'refunded'.
--   Justificativa: o título existiu e (podendo ter sido) liquidado, foi
--   revertido. 'cancelled' seria ambíguo com títulos anulados sem venda,
--   e 'pending' reabriria um recebível de uma venda que não existe mais.
--   Portanto TODO título ligado a uma venda cancelada termina em 'refunded',
--   com paid_at / account_id / payment_method / settlement_session_id nulos.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reverse_sale_finance(_sale_id uuid, _reason text DEFAULT NULL)
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

  -- Sessão de caixa para o espelho: histórica da venda (se aberta),
  -- senão a sessão aberta atual. Se nenhuma existir, o cancelamento
  -- prossegue sem movimento de caixa (caixa fechado) e isso é auditado.
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
      -- 1. Espelho no caixa (idempotente por título).
      IF v_account.id IS NOT NULL AND v_account.type = 'cash' AND v_session_id IS NOT NULL AND v_amount > 0 THEN
        v_note := 'sale_id=' || v_sale.id::text || ' tx=' || v_tx.id::text;
        INSERT INTO public.cash_movements (session_id, company_id, type, amount, reason, note, created_by)
        SELECT v_session_id,
               v_tx.company_id,
               CASE WHEN v_tx.type = 'income' THEN 'cash_out' ELSE 'cash_in' END,
               v_amount,
               'sale_cancellation',
               v_note,
               auth.uid()
        WHERE NOT EXISTS (
          SELECT 1 FROM public.cash_movements cm
          WHERE cm.company_id = v_tx.company_id
            AND cm.reason = 'sale_cancellation'
            AND cm.note = v_note
        );
      END IF;

      -- 2. Reversão do saldo da conta (causa raiz corrigida).
      IF v_account.id IS NOT NULL THEN
        UPDATE public.financial_accounts
           SET current_balance = COALESCE(current_balance, 0)
                 - CASE WHEN v_tx.type = 'income' THEN v_amount ELSE -v_amount END,
               updated_at = now()
         WHERE id = v_account.id;
      END IF;
    END IF;

    -- 3. Estado terminal único + auditoria.
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

REVOKE ALL ON FUNCTION public.reverse_sale_finance(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_sale_finance(uuid, text) TO authenticated, service_role;

-- Trigger passa a apenas delegar: nenhuma lógica financeira própria.
CREATE OR REPLACE FUNCTION public.cancel_sale_finance_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.reverse_sale_finance(NEW.id, NULL);
  RETURN NEW;
END;
$function$;
