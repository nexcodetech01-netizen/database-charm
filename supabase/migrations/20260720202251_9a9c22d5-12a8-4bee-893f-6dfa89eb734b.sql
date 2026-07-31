-- Permitir a origem usada pela reversão de cancelamento.
ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_source_check;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_source_check
  CHECK (
    source IS NULL OR source IN (
      'manual', 'purchase', 'sale', 'adjustment', 'return', 'system',
      'sale_cancellation'
    )
  );

-- Idempotência forte: uma única compensação por venda e produto.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_sale_cancellation_product
  ON public.inventory_movements (reference_id, product_id)
  WHERE source = 'sale_cancellation';

-- Toda movimentação que altera saldo deve afetar exatamente um produto.
CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta numeric := 0;
  affected_rows integer := 0;
BEGIN
  IF NEW.type = 'in' THEN
    delta := ABS(NEW.quantity);
  ELSIF NEW.type = 'out' THEN
    delta := -ABS(NEW.quantity);
  ELSIF NEW.type = 'adjustment' THEN
    delta := NEW.quantity;
  ELSE
    delta := 0;
  END IF;

  IF delta <> 0 THEN
    UPDATE public.products
       SET stock = stock + delta,
           updated_at = now()
     WHERE id = NEW.product_id
       AND company_id = NEW.company_id;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    IF affected_rows <> 1 THEN
      RAISE EXCEPTION
        'Movimentação de estoque não atualizou exatamente um produto (product_id=%, company_id=%, linhas=%).',
        NEW.product_id, NEW.company_id, affected_rows;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Cancelamento de venda paga e reposição de estoque são uma única transação.
CREATE OR REPLACE FUNCTION public.reverse_sale_inventory_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item record;
  inserted_id uuid;
BEGIN
  -- Só há reversão na transição paid -> cancelled.
  IF NEW.status IS DISTINCT FROM 'cancelled'
     OR OLD.status IS DISTINCT FROM 'paid'
     OR COALESCE(NEW.stock_reversed, false) THEN
    RETURN NEW;
  END IF;

  -- Agrupa o mesmo produto para devolver exatamente a soma baixada na venda.
  FOR item IN
    SELECT si.product_id, SUM(si.quantity) AS quantity
      FROM public.sale_items si
     WHERE si.sale_id = NEW.id
       AND si.product_id IS NOT NULL
       AND COALESCE(si.quantity, 0) > 0
     GROUP BY si.product_id
  LOOP
    inserted_id := NULL;

    INSERT INTO public.inventory_movements (
      company_id, product_id, type, quantity,
      reason, notes, movement_date, user_id,
      source, reference_id, reference_number
    ) VALUES (
      NEW.company_id, item.product_id, 'in', item.quantity,
      'Cancelamento de venda',
      'Estorno da venda ' || COALESCE(NEW.number, NEW.id::text),
      now(), NEW.created_by,
      'sale_cancellation', NEW.id, NEW.number
    )
    ON CONFLICT (reference_id, product_id)
      WHERE source = 'sale_cancellation'
    DO NOTHING
    RETURNING id INTO inserted_id;

    -- Um conflito só é válido quando a compensação já existe.
    IF inserted_id IS NULL AND NOT EXISTS (
      SELECT 1
        FROM public.inventory_movements im
       WHERE im.source = 'sale_cancellation'
         AND im.reference_id = NEW.id
         AND im.product_id = item.product_id
    ) THEN
      RAISE EXCEPTION
        'Falha ao registrar reversão de estoque da venda % para o produto %.',
        NEW.id, item.product_id;
    END IF;
  END LOOP;

  UPDATE public.sales
     SET stock_reversed = true,
         stock_applied = false
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reverse_sale_inventory_on_cancel ON public.sales;
CREATE TRIGGER trg_reverse_sale_inventory_on_cancel
AFTER UPDATE OF status ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.reverse_sale_inventory_on_cancel();