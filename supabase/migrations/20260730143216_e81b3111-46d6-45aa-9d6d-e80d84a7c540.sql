-- 1) Remove overload legado (5 args) que ignora desconto na baixa
DROP FUNCTION IF EXISTS public.settle_financial_transaction(uuid, text, uuid, timestamp with time zone, text);

-- 2) Estorno restaura o valor original (desfaz o desconto concedido na baixa)
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
  v_discount numeric;
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
  v_discount := COALESCE(v_tx.discount_amount, 0);

  IF v_was_paid AND v_tx.account_id IS NOT NULL THEN
    SELECT * INTO v_account FROM public.financial_accounts WHERE id = v_tx.account_id;
  END IF;

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
  IF v_discount <> 0 THEN
    v_audit := v_audit || format(' | desconto revertido: %s', to_char(v_discount, 'FM999999990.00'));
  END IF;
  IF NULLIF(btrim(COALESCE(_notes, '')), '') IS NOT NULL THEN
    v_audit := v_audit || ' | motivo: ' || btrim(_notes);
  END IF;

  IF v_was_paid THEN
    UPDATE public.financial_transactions
    SET status = 'pending',
        paid_at = NULL,
        account_id = NULL,
        payment_method = NULL,
        settlement_session_id = NULL,
        -- restaura o valor cheio da obrigação (desfaz desconto/acréscimo da baixa)
        amount = ROUND(v_amount + v_discount, 2),
        discount_amount = 0,
        notes = btrim(COALESCE(notes || E'\n', '') || v_audit),
        updated_at = now()
    WHERE id = _transaction_id
    RETURNING * INTO v_tx;
  ELSE
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

-- 3) Custo médio ponderado passa a usar CUSTO REAL DE AQUISIÇÃO (landed cost):
--    unit_price + rateio proporcional de (frete + seguro + outros custos - desconto)
CREATE OR REPLACE FUNCTION public.apply_purchase_to_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  cur_stock NUMERIC;
  cur_cost  NUMERIC;
  new_cost  NUMERIC;
  new_stock NUMERIC;
  v_reason  TEXT;
  v_items_base NUMERIC;
  v_extra NUMERIC;
  v_landed_unit NUMERIC;
BEGIN
  IF NEW.status = 'received'
     AND (OLD.status IS DISTINCT FROM 'received')
     AND COALESCE(NEW.stock_applied, false) = false THEN

    -- Base de rateio: total dos itens da compra
    SELECT COALESCE(SUM(COALESCE(pi.quantity, 0) * COALESCE(pi.unit_price, 0)), 0)
      INTO v_items_base
      FROM public.purchase_items pi
     WHERE pi.purchase_id = NEW.id;

    v_extra := COALESCE(NEW.shipping, 0) + COALESCE(NEW.insurance, 0)
             + COALESCE(NEW.other_costs, 0) - COALESCE(NEW.discount, 0);

    FOR item IN
      SELECT pi.id AS item_id, pi.product_id, pi.quantity, pi.unit_price, pi.description
        FROM public.purchase_items pi
       WHERE pi.purchase_id = NEW.id
         AND pi.product_id IS NOT NULL
    LOOP
      IF COALESCE(item.quantity, 0) <= 0 THEN
        RAISE EXCEPTION 'Item % da compra % possui quantidade inválida (%). Deve ser maior que zero.',
          COALESCE(item.description, item.item_id::text), COALESCE(NEW.number, NEW.id::text), item.quantity
          USING ERRCODE = 'check_violation';
      END IF;

      IF COALESCE(item.unit_price, 0) < 0 THEN
        RAISE EXCEPTION 'Item % da compra % possui custo unitário negativo (%).',
          COALESCE(item.description, item.item_id::text), COALESCE(NEW.number, NEW.id::text), item.unit_price
          USING ERRCODE = 'check_violation';
      END IF;

      -- Custo unitário real de aquisição (rateio proporcional ao valor do item)
      IF v_items_base > 0 AND v_extra <> 0 THEN
        v_landed_unit := ROUND(
          COALESCE(item.unit_price, 0)
          + (v_extra * ((COALESCE(item.quantity, 0) * COALESCE(item.unit_price, 0)) / v_items_base))
            / NULLIF(item.quantity, 0)
        , 6);
      ELSE
        v_landed_unit := COALESCE(item.unit_price, 0);
      END IF;
      IF v_landed_unit < 0 THEN
        v_landed_unit := 0;
      END IF;

      SELECT stock, cost
        INTO cur_stock, cur_cost
        FROM public.products
       WHERE id = item.product_id
       FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Produto % não encontrado ao aplicar recebimento da compra %.',
          item.product_id, COALESCE(NEW.number, NEW.id::text)
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF cur_stock IS NULL OR cur_stock <= 0 OR cur_cost IS NULL THEN
        new_cost := v_landed_unit;
      ELSE
        new_cost := ((cur_stock * cur_cost) + (item.quantity * v_landed_unit))
                    / (cur_stock + item.quantity);
      END IF;
      new_cost := ROUND(new_cost, 6);

      new_stock := COALESCE(cur_stock, 0) + item.quantity;
      v_reason  := 'Compra ' || COALESCE(NEW.number, NEW.id::text);

      INSERT INTO public.inventory_movements(
        company_id, product_id, type, quantity,
        reason, notes, movement_date, user_id,
        source, reference_id, reference_number
      ) VALUES (
        NEW.company_id, item.product_id, 'in', item.quantity,
        'Compra',
        v_reason,
        COALESCE(NEW.received_at, now()),
        NEW.created_by,
        'purchase', NEW.id, NEW.number
      );

      UPDATE public.products
         SET cost = new_cost,
             updated_at = now()
       WHERE id = item.product_id;

      INSERT INTO public.purchase_receipt_audits(
        company_id, purchase_id, purchase_item_id, product_id,
        quantity, unit_cost,
        previous_stock, new_stock,
        previous_cost, new_cost,
        reason, notes, user_id
      ) VALUES (
        NEW.company_id, NEW.id, item.item_id, item.product_id,
        item.quantity, v_landed_unit,
        COALESCE(cur_stock, 0), new_stock,
        cur_cost, new_cost,
        'purchase_received',
        v_reason || ' (custo com rateio de frete/seguro/outros)',
        NEW.created_by
      );
    END LOOP;

    UPDATE public.purchases SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;