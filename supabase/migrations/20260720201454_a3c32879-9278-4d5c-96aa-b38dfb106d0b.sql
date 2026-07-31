
-- Add stock_reversed flag to sales for idempotent reversal on cancellation
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS stock_reversed boolean NOT NULL DEFAULT false;

-- Trigger function: on cancellation of a sale that had stock applied,
-- generate compensating inventory 'in' movements, exactly one per sale_item.
CREATE OR REPLACE FUNCTION public.reverse_sale_inventory_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
BEGIN
  IF NEW.status = 'cancelled'
     AND (OLD.status IS DISTINCT FROM 'cancelled')
     AND COALESCE(NEW.stock_applied, false) = true
     AND COALESCE(NEW.stock_reversed, false) = false THEN

    FOR item IN
      SELECT si.product_id, si.quantity
        FROM public.sale_items si
       WHERE si.sale_id = NEW.id
         AND si.product_id IS NOT NULL
         AND COALESCE(si.quantity, 0) > 0
    LOOP
      INSERT INTO public.inventory_movements(
        company_id, product_id, type, quantity,
        reason, notes, movement_date, user_id,
        source, reference_id, reference_number
      ) VALUES (
        NEW.company_id, item.product_id, 'in', item.quantity,
        'Cancelamento de venda',
        'Estorno da venda ' || COALESCE(NEW.number, NEW.id::text),
        now(),
        NEW.created_by,
        'sale_cancellation', NEW.id, NEW.number
      );
    END LOOP;

    UPDATE public.sales
       SET stock_reversed = true,
           stock_applied = false
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reverse_sale_inventory_on_cancel ON public.sales;
CREATE TRIGGER trg_reverse_sale_inventory_on_cancel
AFTER UPDATE OF status ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.reverse_sale_inventory_on_cancel();
