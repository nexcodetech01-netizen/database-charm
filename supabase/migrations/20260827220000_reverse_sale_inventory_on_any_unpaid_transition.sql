-- FIX — Estoque não devolvido quando venda paga volta pra 'draft'/'pending'
-- fora do fluxo de cancelamento (2026-08-27).
--
-- Bug encontrado: o checkout (checkout-dialog.tsx) marca sales.status='paid'
-- assim que a baixa financeira é confirmada — isso dispara o gatilho
-- apply_sale_to_inventory, que baixa o estoque. Mas em alguns caminhos de
-- erro (ex: rede cai/troca durante a confirmação, checkout fechado antes da
-- confirmação chegar ao cliente), o app reverte sales.status diretamente
-- para 'draft' (ou 'pending') via UPDATE simples — SEM passar pelo
-- cancelamento oficial (cancel_sale). O gatilho de reversão de estoque só
-- disparava para a transição paid -> cancelled, então nesse outro caminho
-- o estoque ficava debitado para sempre numa venda que nem aparece mais
-- como ativa (caso real: venda PDV-20260827-170352).
--
-- Correção: generaliza o gatilho para reverter o estoque sempre que uma
-- venda que já tinha `stock_applied=true` sai do status 'paid' para
-- QUALQUER outro status (cancelled, draft ou pending) — não só cancelled.
-- Mantém a mesma trava de idempotência (stock_reversed) e o mesmo
-- `source='sale_cancellation'` para reaproveitar o índice único já
-- existente (uq_inventory_sale_cancellation_product).

CREATE OR REPLACE FUNCTION public.reverse_sale_inventory_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item record;
  inserted_id uuid;
  reversed_products integer := 0;
  expected_products integer := 0;
  v_reason text;
BEGIN
  -- Só reverte quando: a venda ESTAVA paga, SAIU do status paga (pra
  -- qualquer outro status: cancelled, draft ou pending), o estoque
  -- realmente tinha sido aplicado, e ainda não foi revertido antes.
  IF (NEW.status = OLD.status)
     OR OLD.status IS DISTINCT FROM 'paid'
     OR COALESCE(NEW.stock_reversed, false)
     OR NOT COALESCE(OLD.stock_applied, false) THEN
    RETURN NEW;
  END IF;

  v_reason := CASE
    WHEN NEW.status = 'cancelled' THEN 'Cancelamento de venda'
    ELSE 'Estorno automático — venda voltou de paga para "' || NEW.status || '" sem cancelamento formal'
  END;

  SELECT COUNT(DISTINCT si.product_id)
    INTO expected_products
    FROM public.sale_items si
   WHERE si.sale_id = NEW.id
     AND si.product_id IS NOT NULL
     AND COALESCE(si.quantity, 0) > 0;

  FOR item IN
    SELECT im.product_id, SUM(ABS(im.quantity)) AS quantity
      FROM public.inventory_movements im
     WHERE im.company_id = NEW.company_id
       AND im.source = 'sale'
       AND im.reference_id = NEW.id
       AND im.type = 'out'
       AND im.product_id IS NOT NULL
       AND COALESCE(im.quantity, 0) <> 0
     GROUP BY im.product_id
  LOOP
    inserted_id := NULL;

    INSERT INTO public.inventory_movements (
      company_id, product_id, type, quantity,
      reason, notes, movement_date, user_id,
      source, reference_id, reference_number
    ) VALUES (
      NEW.company_id, item.product_id, 'in', item.quantity,
      v_reason,
      'Estorno da venda ' || COALESCE(NEW.number, NEW.id::text),
      now(), NEW.created_by,
      'sale_cancellation', NEW.id, NEW.number
    )
    ON CONFLICT (reference_id, product_id)
      WHERE source = 'sale_cancellation'
    DO NOTHING
    RETURNING id INTO inserted_id;

    IF inserted_id IS NOT NULL OR EXISTS (
      SELECT 1
        FROM public.inventory_movements existing
       WHERE existing.source = 'sale_cancellation'
         AND existing.reference_id = NEW.id
         AND existing.product_id = item.product_id
    ) THEN
      reversed_products := reversed_products + 1;
    ELSE
      RAISE EXCEPTION
        'Falha ao registrar reversão de estoque da venda % para o produto %.',
        NEW.id, item.product_id;
    END IF;
  END LOOP;

  IF expected_products > 0 AND reversed_products <> expected_products THEN
    RAISE EXCEPTION
      'Transição abortada: venda % possui % produto(s) controlado(s), mas somente % saída(s) puderam ser revertidas.',
      NEW.id, expected_products, reversed_products;
  END IF;

  UPDATE public.sales
     SET stock_reversed = true,
         stock_applied = false
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Backfill pontual: a venda PDV-20260827-170352 já ficou presa nesse estado
-- (paid -> draft antes desta correção, estoque nunca devolvido). Devolve a
-- unidade agora e marca a venda como corrigida, usando o MESMO mecanismo
-- (source='sale_cancellation' + índice único) para nunca duplicar se esta
-- migration rodar mais de uma vez.
DO $$
DECLARE
  v_sale record;
  v_item record;
BEGIN
  SELECT * INTO v_sale FROM public.sales
   WHERE number = 'PDV-20260827-170352'
     AND status = 'draft'
     AND COALESCE(stock_applied, false) = true
   LIMIT 1;

  IF v_sale.id IS NOT NULL THEN
    FOR v_item IN
      SELECT im.product_id, SUM(ABS(im.quantity)) AS quantity
        FROM public.inventory_movements im
       WHERE im.company_id = v_sale.company_id
         AND im.source = 'sale'
         AND im.reference_id = v_sale.id
         AND im.type = 'out'
       GROUP BY im.product_id
    LOOP
      INSERT INTO public.inventory_movements (
        company_id, product_id, type, quantity,
        reason, notes, movement_date, user_id,
        source, reference_id, reference_number
      ) VALUES (
        v_sale.company_id, v_item.product_id, 'in', v_item.quantity,
        'Estorno automático — venda voltou de paga para "draft" sem cancelamento formal (backfill do bug)',
        'Estorno da venda ' || COALESCE(v_sale.number, v_sale.id::text),
        now(), v_sale.created_by,
        'sale_cancellation', v_sale.id, v_sale.number
      )
      ON CONFLICT (reference_id, product_id)
        WHERE source = 'sale_cancellation'
      DO NOTHING;
    END LOOP;

    UPDATE public.sales
       SET stock_reversed = true,
           stock_applied = false
     WHERE id = v_sale.id;
  END IF;
END $$;
