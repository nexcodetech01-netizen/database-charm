CREATE OR REPLACE FUNCTION public.apply_purchase_to_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
BEGIN
  IF NEW.status = 'received'
     AND (OLD.status IS DISTINCT FROM 'received')
     AND COALESCE(NEW.stock_applied, false) = false THEN

    FOR item IN
      SELECT pi.product_id, pi.quantity, pi.unit_price
        FROM public.purchase_items pi
       WHERE pi.purchase_id = NEW.id
         AND pi.product_id IS NOT NULL
    LOOP
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
    END LOOP;

    UPDATE public.purchases SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;