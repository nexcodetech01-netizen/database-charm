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
BEGIN
  IF NEW.status = 'received'
     AND (OLD.status IS DISTINCT FROM 'received')
     AND COALESCE(NEW.stock_applied, false) = false THEN

    FOR item IN
      SELECT pi.product_id, pi.quantity, pi.unit_price
        FROM public.purchase_items pi
       WHERE pi.purchase_id = NEW.id
         AND pi.product_id IS NOT NULL
         AND COALESCE(pi.quantity, 0) > 0
    LOOP
      -- Lê estoque e custo ANTES da entrada, com lock da linha do produto
      SELECT stock, cost
        INTO cur_stock, cur_cost
        FROM public.products
       WHERE id = item.product_id
       FOR UPDATE;

      -- Custo médio ponderado. Produto novo / sem custo / estoque zero => custo = unit_price.
      IF cur_stock IS NULL OR cur_stock <= 0 OR cur_cost IS NULL THEN
        new_cost := item.unit_price;
      ELSE
        new_cost := ((cur_stock * cur_cost) + (item.quantity * item.unit_price))
                    / (cur_stock + item.quantity);
      END IF;

      -- Movimento de entrada (dispara trigger que soma em products.stock)
      INSERT INTO public.inventory_movements(
        company_id, product_id, type, quantity,
        reason, notes, movement_date, user_id,
        source, reference_id, reference_number
      ) VALUES (
        NEW.company_id, item.product_id, 'in', item.quantity,
        'Compra',
        'Compra ' || COALESCE(NEW.number, NEW.id::text),
        COALESCE(NEW.received_at, now()),
        NEW.created_by,
        'purchase', NEW.id, NEW.number
      );

      -- Atualiza apenas o custo. Não toca em price/markup/margin/outros campos.
      UPDATE public.products
         SET cost = new_cost,
             updated_at = now()
       WHERE id = item.product_id;
    END LOOP;

    UPDATE public.purchases SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;