-- Receber compra falhava desde 22/10: o gatilho ativo no banco ainda era a
-- versão de 20260826, que chama recalculate_product_v2_price — removida em
-- 20261022200000 (security batch). Reaplica a versão de 20260916130000,
-- idêntica exceto por não recalcular o preço automaticamente.
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
  v_items_base NUMERIC;
  v_share NUMERIC;
  v_unit_price NUMERIC;
  v_freight_unit NUMERIC;
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
      v_unit_price := ROUND(COALESCE(item.unit_price, 0), 6);

      IF v_items_base > 0 THEN
        v_share := (COALESCE(item.quantity, 0) * COALESCE(item.unit_price, 0)) / v_items_base;
      ELSE
        v_share := 0;
      END IF;

      v_freight_unit := ROUND((COALESCE(NEW.shipping, 0)  * v_share) / item.quantity, 6);
      v_other_unit   := ROUND((v_other_total              * v_share) / item.quantity, 6);

      SELECT stock, cost INTO cur_stock, cur_cost
        FROM public.products WHERE id = item.product_id FOR UPDATE;

      IF cur_stock IS NULL OR cur_stock <= 0 OR cur_cost IS NULL THEN
        new_cost := v_unit_price;
      ELSE
        new_cost := ((cur_stock * cur_cost) + (item.quantity * v_unit_price)) / (cur_stock + item.quantity);
      END IF;
      new_cost := ROUND(new_cost, 6);

      -- Movimentação de estoque — isso sozinho JÁ soma a quantidade
      -- ao estoque do produto, através do gatilho
      -- `trg_apply_inventory_movement` (existe desde 13/07/2026).
      INSERT INTO public.inventory_movements(
        company_id, product_id, type, quantity, reason, notes, movement_date, user_id,
        source, reference_id, reference_number, unit_cost, total_cost
      ) VALUES (
        NEW.company_id, item.product_id, 'in', item.quantity, 'Compra',
        'Compra ' || COALESCE(NEW.number, NEW.id::text) || ' (Rateio: Frete ' || v_freight_unit || ', Outros ' || v_other_unit || ')',
        COALESCE(NEW.received_at, now()), NEW.created_by,
        'purchase', NEW.id, NEW.number, v_unit_price, ROUND(v_unit_price * item.quantity, 6)
      );

      UPDATE public.products
         SET cost = new_cost,
             freight = COALESCE(v_freight_unit, 0),
             other_costs = COALESCE(v_other_unit, 0),
             updated_at = now()
       WHERE id = item.product_id;

      -- CORRIGIDO (2026-09-16): removida a chamada automática de
      -- recalculate_product_v2_price daqui — ver comentário no topo
      -- desta migration. Preço de produto existente não muda mais
      -- sozinho ao receber uma compra.
    END LOOP;

    UPDATE public.purchases SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;
