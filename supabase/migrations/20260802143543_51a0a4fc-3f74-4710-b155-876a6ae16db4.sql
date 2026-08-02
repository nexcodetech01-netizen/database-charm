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
  v_share NUMERIC;
  v_unit_price NUMERIC;
  v_freight_unit NUMERIC;
  v_insurance_unit NUMERIC;
  v_other_unit NUMERIC;
  v_other_total NUMERIC;
BEGIN
  IF NEW.status = 'received'
     AND (OLD.status IS DISTINCT FROM 'received')
     AND COALESCE(NEW.stock_applied, false) = false THEN

    SELECT COALESCE(SUM(COALESCE(pi.quantity, 0) * COALESCE(pi.unit_price, 0)), 0)
      INTO v_items_base FROM public.purchase_items pi WHERE pi.purchase_id = NEW.id;

    v_other_total := GREATEST(COALESCE(NEW.other_costs, 0) - COALESCE(NEW.discount, 0), 0);

    FOR item IN
      SELECT pi.id AS item_id, pi.product_id, pi.quantity, pi.unit_price, pi.description
        FROM public.purchase_items pi
       WHERE pi.purchase_id = NEW.id AND pi.product_id IS NOT NULL
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

      -- Custo puro: nunca embute frete/seguro/outros.
      v_unit_price := ROUND(COALESCE(item.unit_price, 0), 6);

      -- Rateio proporcional ao valor bruto do item, por unidade.
      IF v_items_base > 0 THEN
        v_share := (COALESCE(item.quantity, 0) * COALESCE(item.unit_price, 0)) / v_items_base;
      ELSE
        v_share := 0;
      END IF;

      v_freight_unit   := ROUND((COALESCE(NEW.shipping, 0)  * v_share) / NULLIF(item.quantity, 0), 6);
      v_insurance_unit := ROUND((COALESCE(NEW.insurance, 0) * v_share) / NULLIF(item.quantity, 0), 6);
      v_other_unit     := ROUND((v_other_total              * v_share) / NULLIF(item.quantity, 0), 6);

      SELECT stock, cost INTO cur_stock, cur_cost
        FROM public.products WHERE id = item.product_id FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Produto % não encontrado ao aplicar recebimento da compra %.',
          item.product_id, COALESCE(NEW.number, NEW.id::text) USING ERRCODE = 'foreign_key_violation';
      END IF;

      -- Custo médio ponderado sobre o preço puro.
      IF cur_stock IS NULL OR cur_stock <= 0 OR cur_cost IS NULL THEN
        new_cost := v_unit_price;
      ELSE
        new_cost := ((cur_stock * cur_cost) + (item.quantity * v_unit_price)) / (cur_stock + item.quantity);
      END IF;
      new_cost := ROUND(new_cost, 6);

      new_stock := COALESCE(cur_stock, 0) + item.quantity;
      v_reason  := 'Compra ' || COALESCE(NEW.number, NEW.id::text);

      INSERT INTO public.inventory_movements(
        company_id, product_id, type, quantity, reason, notes, movement_date, user_id,
        source, reference_id, reference_number, unit_cost, total_cost
      ) VALUES (
        NEW.company_id, item.product_id, 'in', item.quantity, 'Compra',
        v_reason || ' (preço puro; rateio unitário — frete ' || COALESCE(v_freight_unit, 0)
                 || ', seguro ' || COALESCE(v_insurance_unit, 0)
                 || ', outros ' || COALESCE(v_other_unit, 0) || ')',
        COALESCE(NEW.received_at, now()), NEW.created_by,
        'purchase', NEW.id, NEW.number, v_unit_price, ROUND(v_unit_price * item.quantity, 6)
      );

      UPDATE public.products
         SET cost = new_cost,
             last_purchase_cost = v_unit_price,
             freight = COALESCE(v_freight_unit, 0),
             insurance = COALESCE(v_insurance_unit, 0),
             other_costs = COALESCE(v_other_unit, 0),
             updated_at = now()
       WHERE id = item.product_id;

      INSERT INTO public.purchase_receipt_audits(
        company_id, purchase_id, purchase_item_id, product_id, quantity, unit_cost,
        previous_stock, new_stock, previous_cost, new_cost, reason, notes, user_id
      ) VALUES (
        NEW.company_id, NEW.id, item.item_id, item.product_id, item.quantity, v_unit_price,
        COALESCE(cur_stock, 0), new_stock, cur_cost, new_cost, 'purchase_received',
        v_reason || ' (custo puro; frete/seguro/outros rateados em campos auxiliares)', NEW.created_by
      );
    END LOOP;

    UPDATE public.purchases SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;