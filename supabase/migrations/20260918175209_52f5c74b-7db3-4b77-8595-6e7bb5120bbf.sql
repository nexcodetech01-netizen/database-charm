-- Protege o bounce técnico de reprocess_received_purchase sem desativar
-- reversões legítimas feitas por mudanças reais de status.

CREATE OR REPLACE FUNCTION public.reverse_purchase_inventory_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item record;
  inserted_id uuid;
  reversed_products integer := 0;
  expected_products integer := 0;
  v_reason text;
BEGIN
  IF COALESCE(current_setting('app.purchase_reprocessing', true), 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  IF (NEW.status = OLD.status)
     OR OLD.status IS DISTINCT FROM 'received'
     OR COALESCE(NEW.stock_reversed, false)
     OR NOT COALESCE(OLD.stock_applied, false) THEN
    RETURN NEW;
  END IF;

  v_reason := CASE
    WHEN NEW.status = 'cancelled' THEN 'Estorno por Cancelamento de Compra'
    ELSE 'Estorno automático — compra voltou de recebida para "' || NEW.status || '" sem cancelamento formal'
  END;

  SELECT COUNT(DISTINCT pi.product_id)
    INTO expected_products
    FROM public.purchase_items pi
   WHERE pi.purchase_id = NEW.id
     AND pi.product_id IS NOT NULL
     AND COALESCE(pi.quantity, 0) > 0;

  FOR item IN
    SELECT im.product_id, SUM(ABS(im.quantity)) AS quantity
      FROM public.inventory_movements im
     WHERE im.company_id = NEW.company_id
       AND im.source = 'purchase'
       AND im.reference_id = NEW.id
       AND im.type = 'in'
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
      NEW.company_id, item.product_id, 'out', item.quantity,
      v_reason,
      'Estorno da compra ' || COALESCE(NEW.number, NEW.id::text),
      now(), NEW.created_by,
      'purchase_cancellation', NEW.id, NEW.number
    )
    ON CONFLICT (reference_id, product_id)
      WHERE source = 'purchase_cancellation'
    DO NOTHING
    RETURNING id INTO inserted_id;

    IF inserted_id IS NOT NULL OR EXISTS (
      SELECT 1
        FROM public.inventory_movements existing
       WHERE existing.source = 'purchase_cancellation'
         AND existing.reference_id = NEW.id
         AND existing.product_id = item.product_id
    ) THEN
      reversed_products := reversed_products + 1;
    ELSE
      RAISE EXCEPTION
        'Falha ao registrar reversão de estoque da compra % para o produto %.',
        NEW.id, item.product_id;
    END IF;
  END LOOP;

  IF expected_products > 0 AND reversed_products <> expected_products THEN
    RAISE EXCEPTION
      'Transição abortada: compra % possui % produto(s) controlado(s), mas somente % entrada(s) puderam ser revertidas.',
      NEW.id, expected_products, reversed_products;
  END IF;

  UPDATE public.purchases
     SET stock_reversed = true,
         stock_applied = false
   WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_purchase_finance_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(current_setting('app.purchase_reprocessing', true), 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  PERFORM public.reverse_purchase_finance(NEW.id, NULL);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reprocess_received_purchase(_purchase_id uuid)
RETURNS public.purchases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_item RECORD;
  v_new_product_id uuid;
  v_sku text;
BEGIN
  SELECT * INTO v_purchase FROM public.purchases WHERE id = _purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra % não encontrada.', _purchase_id;
  END IF;
  IF NOT public.user_has_company_access(v_purchase.company_id) THEN
    RAISE EXCEPTION 'Sem permissão para reprocessar esta compra.' USING ERRCODE = '42501';
  END IF;
  IF v_purchase.status <> 'received' THEN
    RAISE EXCEPTION 'Somente compras recebidas podem ser reprocessadas.';
  END IF;
  IF COALESCE(v_purchase.stock_applied, false) = true THEN
    RETURN v_purchase;
  END IF;

  FOR v_item IN
    SELECT id, description, unit_price
      FROM public.purchase_items
     WHERE purchase_id = _purchase_id
       AND product_id IS NULL
       AND COALESCE(TRIM(description), '') <> ''
  LOOP
    v_new_product_id := public.find_existing_product(v_purchase.company_id, v_item.description, NULL, NULL);

    IF v_new_product_id IS NOT NULL THEN
      UPDATE public.products
         SET cost = COALESCE(v_item.unit_price, cost),
             updated_at = now()
       WHERE id = v_new_product_id;
    ELSE
      v_sku := public.generate_product_sku(v_purchase.company_id, v_item.description, NULL);
      IF v_sku IS NULL OR v_sku = '' THEN
        RAISE EXCEPTION 'Falha ao gerar SKU para item "%".', v_item.description;
      END IF;

      INSERT INTO public.products (
        company_id, name, sku, supplier_id, cost, stock, status
      ) VALUES (
        v_purchase.company_id,
        v_item.description,
        v_sku,
        v_purchase.supplier_id,
        COALESCE(v_item.unit_price, 0),
        0,
        'active'
      )
      RETURNING id INTO v_new_product_id;
    END IF;

    UPDATE public.purchase_items
       SET product_id = v_new_product_id, updated_at = now()
     WHERE id = v_item.id;
  END LOOP;

  PERFORM set_config('app.purchase_reprocessing', 'true', true);

  UPDATE public.purchases SET status = 'pending' WHERE id = _purchase_id;
  UPDATE public.purchases
     SET status = 'received',
         received_at = COALESCE(received_at, now()),
         updated_at = now()
   WHERE id = _purchase_id
   RETURNING * INTO v_purchase;

  RETURN v_purchase;
END;
$function$;

DROP TRIGGER IF EXISTS trg_reverse_purchase_inventory_on_cancel ON public.purchases;
CREATE TRIGGER trg_reverse_purchase_inventory_on_cancel
AFTER UPDATE OF status ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.reverse_purchase_inventory_on_cancel();

DROP TRIGGER IF EXISTS a_cancel_purchase_finance_on_cancel ON public.purchases;
CREATE TRIGGER a_cancel_purchase_finance_on_cancel
AFTER UPDATE OF status ON public.purchases
FOR EACH ROW
WHEN (
  OLD.status = 'received'
  AND NEW.status IS DISTINCT FROM 'received'
)
EXECUTE FUNCTION public.cancel_purchase_finance_on_cancel();

REVOKE ALL ON FUNCTION public.reprocess_received_purchase(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reprocess_received_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reprocess_received_purchase(uuid) TO service_role;