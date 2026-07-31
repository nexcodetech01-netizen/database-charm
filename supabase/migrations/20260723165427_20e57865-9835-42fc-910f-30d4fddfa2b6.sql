
CREATE OR REPLACE FUNCTION public.reprocess_received_purchase(_purchase_id uuid)
RETURNS public.purchases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_item RECORD;
  v_new_product_id uuid;
  v_base text;
  v_sku text;
  v_suffix int;
BEGIN
  SELECT * INTO v_purchase FROM public.purchases WHERE id = _purchase_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra % não encontrada.', _purchase_id;
  END IF;

  IF NOT public.user_has_company_access(v_purchase.company_id) THEN
    RAISE EXCEPTION 'Sem permissão para reprocessar esta compra.' USING ERRCODE = '42501';
  END IF;

  IF v_purchase.status <> 'received' THEN
    RAISE EXCEPTION 'Somente compras recebidas podem ser reprocessadas.';
  END IF;

  IF COALESCE(v_purchase.stock_applied, false) = true THEN
    RETURN v_purchase; -- nada a fazer
  END IF;

  -- 1) Cria produtos faltantes para itens sem product_id
  FOR v_item IN
    SELECT id, description, unit_price
      FROM public.purchase_items
     WHERE purchase_id = _purchase_id
       AND product_id IS NULL
       AND COALESCE(TRIM(description), '') <> ''
  LOOP
    v_base := 'PROD-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text,'-','') FROM 1 FOR 6));
    v_sku := v_base;
    v_suffix := 1;
    WHILE EXISTS (
      SELECT 1 FROM public.products
       WHERE company_id = v_purchase.company_id AND sku = v_sku
    ) LOOP
      v_suffix := v_suffix + 1;
      v_sku := v_base || '-' || v_suffix;
    END LOOP;

    INSERT INTO public.products (
      company_id, name, sku, supplier_id, cost, stock, status
    ) VALUES (
      v_purchase.company_id,
      v_item.description,
      v_sku,
      v_purchase.supplier_id,
      COALESCE(v_item.unit_price, 0),
      0,
      'active'
    )
    RETURNING id INTO v_new_product_id;

    UPDATE public.purchase_items
       SET product_id = v_new_product_id, updated_at = now()
     WHERE id = v_item.id;
  END LOOP;

  -- 2) Reexecuta os triggers apply_purchase_to_inventory / apply_purchase_to_finance,
  --    que só disparam na transição OLD.status <> 'received'. Faz o "bounce"
  --    para pending e volta para received na mesma transação.
  UPDATE public.purchases SET status = 'pending' WHERE id = _purchase_id;

  UPDATE public.purchases
     SET status = 'received',
         received_at = COALESCE(received_at, now()),
         updated_at = now()
   WHERE id = _purchase_id
   RETURNING * INTO v_purchase;

  RETURN v_purchase;
END;
$$;

REVOKE ALL ON FUNCTION public.reprocess_received_purchase(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reprocess_received_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reprocess_received_purchase(uuid) TO service_role;

-- Backlog: processa todas as compras já recebidas sem estoque aplicado.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.purchases
     WHERE status = 'received' AND COALESCE(stock_applied, false) = false
  LOOP
    BEGIN
      PERFORM public.reprocess_received_purchase(r.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Falha ao reprocessar compra %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;
