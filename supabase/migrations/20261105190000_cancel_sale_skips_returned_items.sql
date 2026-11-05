-- Cancelar venda depois de uma troca devolvia a peça ao estoque de novo
-- (caso real 05/11: VD-20261029-0004, Tommy Branca M ficou com 2). Agora o
-- cancelamento desconta o que já voltou por troca/devolução.
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
     OR OLD.status = 'cancelled'
     OR COALESCE(NEW.stock_reversed, false)
     OR NOT COALESCE(OLD.stock_applied, false) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(DISTINCT product_id)
    INTO expected_products
    FROM (
      SELECT si.product_id
        FROM public.sale_items si
        JOIN public.products p ON p.id = si.product_id
       WHERE si.sale_id = NEW.id
         AND si.product_id IS NOT NULL
         AND COALESCE(si.quantity, 0) > 0
         AND p.product_type IS DISTINCT FROM 'kit'
      UNION
      SELECT pkc.component_id AS product_id
        FROM public.sale_items si
        JOIN public.products p ON p.id = si.product_id
        JOIN public.product_kit_components pkc ON pkc.parent_id = si.product_id
       WHERE si.sale_id = NEW.id
         AND si.product_id IS NOT NULL
         AND COALESCE(si.quantity, 0) > 0
         AND p.product_type = 'kit'
    ) expected;

  -- Peças já devolvidas (troca/devolução) voltaram ao estoque na hora;
  -- o cancelamento devolve só o que ainda está com a cliente.
  FOR item IN
    SELECT o.product_id,
           o.quantity - COALESCE(r.quantity, 0) AS quantity
      FROM (
        SELECT im.product_id, SUM(ABS(im.quantity)) AS quantity
          FROM public.inventory_movements im
         WHERE im.company_id = NEW.company_id
           AND im.source IN ('sale', 'sale_kit_explosion')
           AND im.reference_id = NEW.id
           AND im.type = 'out'
           AND im.product_id IS NOT NULL
           AND COALESCE(im.quantity, 0) <> 0
         GROUP BY im.product_id
      ) o
      LEFT JOIN (
        SELECT sri.product_id, SUM(sri.quantity) AS quantity
          FROM public.sale_return_items sri
          JOIN public.sale_returns sr ON sr.id = sri.return_id
         WHERE sr.sale_id = NEW.id
           AND sr.status = 'completed'
           AND sri.product_id IS NOT NULL
         GROUP BY sri.product_id
      ) r ON r.product_id = o.product_id
  LOOP
    inserted_id := NULL;

    IF item.quantity <= 0 THEN
      reversed_products := reversed_products + 1;
      CONTINUE;
    END IF;

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

  -- Conferência só para venda paga (mesma regra de antes). Venda "A Receber"
  -- baixa o kit pelo próprio produto, então a contagem por componente não
  -- bate — nela devolvemos exatamente o que saiu, sem travar o cancelamento.
  IF OLD.status = 'paid' AND expected_products > 0 AND reversed_products <> expected_products THEN
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

REVOKE EXECUTE ON FUNCTION public.reverse_sale_inventory_on_cancel() FROM PUBLIC, anon, authenticated;
