
-- Sprint 6 — Estoque Integrado

-- 1) Expandir tipos permitidos e adicionar campos de origem
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check;
ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_type_check
  CHECK (type IN ('in','out','adjustment','transfer','reservation'));

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS reference_id UUID,
  ADD COLUMN IF NOT EXISTS reference_number TEXT;

ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_source_check;
ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_source_check
  CHECK (source IS NULL OR source IN ('manual','purchase','sale','adjustment','return','system'));

CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference
  ON public.inventory_movements(reference_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_company_date
  ON public.inventory_movements(company_id, movement_date DESC);

-- 2) Reservation não altera saldo — atualizar trigger existente
CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta NUMERIC := 0;
BEGIN
  IF NEW.type = 'in' THEN
    delta := ABS(NEW.quantity);
  ELSIF NEW.type = 'out' THEN
    delta := -ABS(NEW.quantity);
  ELSIF NEW.type = 'adjustment' THEN
    delta := NEW.quantity;
  ELSE
    delta := 0; -- reservation, transfer
  END IF;

  IF delta <> 0 THEN
    UPDATE public.products
       SET stock = stock + delta,
           updated_at = now()
     WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_inventory_movement ON public.inventory_movements;
CREATE TRIGGER trg_apply_inventory_movement
AFTER INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_movement();

-- 3) Integração Compras -> Estoque
CREATE OR REPLACE FUNCTION public.apply_purchase_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
BEGIN
  IF NEW.status = 'received'
     AND (OLD.status IS DISTINCT FROM 'received')
     AND COALESCE(NEW.stock_applied, false) = false THEN

    FOR item IN
      SELECT pi.product_id, pi.quantity, pi.unit_cost
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
$$;

DROP TRIGGER IF EXISTS trg_apply_purchase_to_inventory ON public.purchases;
CREATE TRIGGER trg_apply_purchase_to_inventory
AFTER UPDATE OF status ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.apply_purchase_to_inventory();
