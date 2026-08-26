-- BUG ATIVO ENCONTRADO E CORRIGIDO (2026-08-26): diferente das vendas
-- (que já têm um gatilho automático desde 25/07/2026 cancelando os
-- lançamentos financeiros junto quando a venda é cancelada — ver
-- `a_cancel_sale_finance_on_cancel`), as COMPRAS nunca tiveram essa
-- proteção. `purchasesService.setStatus()` faz um UPDATE simples de
-- status pra qualquer status que não seja "received" (inclusive
-- "cancelled") — sem nenhum gatilho no banco cuidando disso. Isso é
-- o MESMO problema que causou a confusão de hoje nas vendas, só que
-- pras compras nunca foi corrigido — pode estar acontecendo agora
-- mesmo, não só no passado.
--
-- Corrigido com o mesmo padrão já usado nas vendas: função
-- `reverse_purchase_finance` (espelha `reverse_sale_finance`) +
-- gatilho automático que a chama sempre que uma compra VIRA cancelada.

CREATE OR REPLACE FUNCTION public.reverse_purchase_finance(_purchase_id uuid, _reason text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase    public.purchases%ROWTYPE;
  v_tx          public.financial_transactions%ROWTYPE;
  v_account     public.financial_accounts%ROWTYPE;
  v_session_id  uuid;
  v_amount      numeric;
  v_audit       text;
  v_note        text;
  v_count       integer := 0;
BEGIN
  SELECT * INTO v_purchase FROM public.purchases WHERE id = _purchase_id;
  IF v_purchase.id IS NULL THEN
    RAISE EXCEPTION 'Compra não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  -- Compras não têm cash_session_id próprio (diferente de vendas) —
  -- usa a sessão de caixa aberta da empresa, se houver, pra registrar
  -- a devolução do dinheiro no caixa quando aplicável.
  SELECT cs.id INTO v_session_id
  FROM public.cash_sessions cs
  WHERE cs.company_id = v_purchase.company_id AND cs.status = 'open'
  ORDER BY cs.opened_at DESC
  LIMIT 1;

  FOR v_tx IN
    SELECT ft.*
    FROM public.financial_transactions ft
    WHERE ft.company_id = v_purchase.company_id
      AND ft.status IN ('paid', 'pending', 'overdue')
      AND ft.source = 'purchase'
      AND ft.reference_id = v_purchase.id
    FOR UPDATE
  LOOP
    v_amount  := COALESCE(v_tx.amount, 0);
    v_account := NULL;
    IF v_tx.account_id IS NOT NULL THEN
      SELECT * INTO v_account FROM public.financial_accounts WHERE id = v_tx.account_id;
    END IF;

    IF v_tx.status = 'paid' THEN
      -- Lançamento de compra é despesa (saiu do caixa) — cancelar
      -- devolve esse valor (cash_in), o inverso do que a venda faz.
      IF v_account.id IS NOT NULL AND v_account.type = 'cash' AND v_session_id IS NOT NULL AND v_amount > 0 THEN
        v_note := 'purchase_id=' || v_purchase.id::text || ' tx=' || v_tx.id::text;
        INSERT INTO public.cash_movements (session_id, company_id, type, amount, reason, note, created_by, transaction_id)
        SELECT v_session_id,
               v_tx.company_id,
               CASE WHEN v_tx.type = 'income' THEN 'cash_out' ELSE 'cash_in' END,
               v_amount,
               'purchase_cancellation',
               v_note,
               auth.uid(),
               v_tx.id
        WHERE NOT EXISTS (
          SELECT 1 FROM public.cash_movements cm
          WHERE cm.company_id = v_tx.company_id
            AND cm.reason = 'purchase_cancellation'
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
      '[cancelamento de compra %s] estado anterior: %s | baixa original: %s | forma: %s | conta: %s | valor: %s',
      to_char(now(), 'YYYY-MM-DD HH24:MI'),
      v_tx.status,
      COALESCE(to_char(v_tx.paid_at, 'YYYY-MM-DD HH24:MI'), '—'),
      COALESCE(v_tx.payment_method, '—'),
      COALESCE(v_account.name, '—'),
      to_char(v_amount, 'FM999999990.00')
    );
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

REVOKE ALL ON FUNCTION public.reverse_purchase_finance(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.reverse_purchase_finance(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_purchase_finance(uuid, text) TO service_role;

-- Gatilho: dispara automaticamente sempre que uma compra VIRA
-- cancelada (mesma condição usada nas vendas — só na transição, não
-- em compras que já estavam canceladas sendo tocadas de novo depois).
CREATE OR REPLACE FUNCTION public.cancel_purchase_finance_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.reverse_purchase_finance(NEW.id, NULL);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS a_cancel_purchase_finance_on_cancel ON public.purchases;
CREATE TRIGGER a_cancel_purchase_finance_on_cancel
AFTER UPDATE OF status ON public.purchases
FOR EACH ROW
WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
EXECUTE FUNCTION public.cancel_purchase_finance_on_cancel();
