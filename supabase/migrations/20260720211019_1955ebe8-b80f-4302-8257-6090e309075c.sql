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
BEGIN
  IF NEW.status IS DISTINCT FROM 'cancelled'
     OR OLD.status IS DISTINCT FROM 'paid'
     OR COALESCE(NEW.stock_reversed, false) THEN
    RETURN NEW;
  END IF;

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
      'Cancelamento de venda',
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
      'Cancelamento abortado: venda % possui % produto(s) controlado(s), mas somente % saída(s) puderam ser revertidas.',
      NEW.id, expected_products, reversed_products;
  END IF;

  UPDATE public.sales
     SET stock_reversed = true,
         stock_applied = false
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_sale public.sales%ROWTYPE;
BEGIN
  SELECT *
    INTO current_sale
    FROM public.sales
   WHERE id = _sale_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada ou sem permissão para cancelar.';
  END IF;

  IF current_sale.status = 'cancelled' THEN
    RETURN current_sale;
  END IF;

  IF current_sale.status NOT IN ('draft', 'pending', 'paid') THEN
    RAISE EXCEPTION 'A venda no status % não pode ser cancelada.', current_sale.status;
  END IF;

  UPDATE public.sales
     SET status = 'cancelled'
   WHERE id = _sale_id
   RETURNING * INTO current_sale;

  RETURN current_sale;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_sale(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid) TO service_role;

DROP TRIGGER IF EXISTS trg_reverse_sale_inventory_on_cancel ON public.sales;
CREATE TRIGGER trg_reverse_sale_inventory_on_cancel
AFTER UPDATE OF status ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.reverse_sale_inventory_on_cancel();