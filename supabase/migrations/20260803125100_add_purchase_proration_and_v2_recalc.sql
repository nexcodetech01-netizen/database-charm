-- Atualiza a função de aplicação de compra para garantir rateio e recálculo do V2
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
  -- Só processa se status mudar para 'received' e ainda não tiver sido aplicado
  IF NEW.status = 'received'
     AND (OLD.status IS DISTINCT FROM 'received')
     AND COALESCE(NEW.stock_applied, false) = false THEN

    -- Base de rateio: Valor bruto total dos itens
    SELECT COALESCE(SUM(COALESCE(pi.quantity, 0) * COALESCE(pi.unit_price, 0)), 0)
      INTO v_items_base FROM public.purchase_items pi WHERE pi.purchase_id = NEW.id;

    -- Outros custos líquidos (outros custos - desconto da compra)
    v_other_total := GREATEST(COALESCE(NEW.other_costs, 0) - COALESCE(NEW.discount, 0), 0);

    FOR item IN
      SELECT pi.id AS item_id, pi.product_id, pi.quantity, pi.unit_price, pi.description
        FROM public.purchase_items pi
       WHERE pi.purchase_id = NEW.id AND pi.product_id IS NOT NULL
    LOOP
      IF COALESCE(item.quantity, 0) <= 0 THEN
        RAISE EXCEPTION 'Item % da compra % possui quantidade inválida.',
          COALESCE(item.description, item.item_id::text), COALESCE(NEW.number, NEW.id::text)
          USING ERRCODE = 'check_violation';
      END IF;

      -- Custo unitário puro (aquisição)
      v_unit_price := ROUND(COALESCE(item.unit_price, 0), 6);

      -- Cálculo do rateio (Proporcional ao valor)
      IF v_items_base > 0 THEN
        v_share := (COALESCE(item.quantity, 0) * COALESCE(item.unit_price, 0)) / v_items_base;
      ELSE
        v_share := 0;
      END IF;

      -- Valores unitários rateados
      v_freight_unit   := ROUND((COALESCE(NEW.shipping, 0)  * v_share) / item.quantity, 6);
      v_insurance_unit := ROUND((COALESCE(NEW.insurance, 0) * v_share) / item.quantity, 6);
      v_other_unit     := ROUND((v_other_total              * v_share) / item.quantity, 6);

      -- Lock do produto para atualização de custo/estoque
      SELECT stock, cost INTO cur_stock, cur_cost
        FROM public.products WHERE id = item.product_id FOR UPDATE;

      -- Custo médio ponderado sobre o preço de aquisição (unit_price)
      IF cur_stock IS NULL OR cur_stock <= 0 OR cur_cost IS NULL THEN
        new_cost := v_unit_price;
      ELSE
        new_cost := ((cur_stock * cur_cost) + (item.quantity * v_unit_price)) / (cur_stock + item.quantity);
      END IF;
      new_cost := ROUND(new_cost, 6);

      new_stock := COALESCE(cur_stock, 0) + item.quantity;
      v_reason  := 'Compra ' || COALESCE(NEW.number, NEW.id::text);

      -- Registro de movimentação
      INSERT INTO public.inventory_movements(
        company_id, product_id, type, quantity, reason, notes, movement_date, user_id,
        source, reference_id, reference_number, unit_cost, total_cost
      ) VALUES (
        NEW.company_id, item.product_id, 'in', item.quantity, 'Compra',
        v_reason || ' (Rateio: Frete ' || v_freight_unit || ', Outros ' || v_other_unit || ')',
        COALESCE(NEW.received_at, now()), NEW.created_by,
        'purchase', NEW.id, NEW.number, v_unit_price, ROUND(v_unit_price * item.quantity, 6)
      );

      -- Atualiza o produto com custo novo e componentes de rateio
      -- Isso disparará o recálculo do Motor V2 se houver trigger de precificação automática
      UPDATE public.products
         SET cost = new_cost,
             last_purchase_cost = v_unit_price,
             freight = COALESCE(v_freight_unit, 0),
             insurance = COALESCE(v_insurance_unit, 0),
             other_costs = COALESCE(v_other_unit, 0),
             updated_at = now()
       WHERE id = item.product_id;

    END LOOP;

    UPDATE public.purchases SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;
