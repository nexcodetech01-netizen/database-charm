
CREATE OR REPLACE FUNCTION public.receive_purchase(_purchase_id uuid)
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
  -- Trava a compra para evitar concorrência (duplo clique / webhook simultâneo).
  SELECT * INTO v_purchase FROM public.purchases WHERE id = _purchase_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra % não encontrada.', _purchase_id;
  END IF;

  IF NOT public.user_has_company_access(v_purchase.company_id) THEN
    RAISE EXCEPTION 'Sem permissão para receber esta compra.' USING ERRCODE = '42501';
  END IF;

  IF v_purchase.status = 'received' THEN
    RETURN v_purchase; -- idempotente
  END IF;

  IF v_purchase.status = 'cancelled' THEN
    RAISE EXCEPTION 'Compra cancelada não pode ser recebida.';
  END IF;

  -- Cria produtos automaticamente para itens sem product_id.
  FOR v_item IN
    SELECT id, description, unit_price
      FROM public.purchase_items
     WHERE purchase_id = _purchase_id
       AND product_id IS NULL
       AND COALESCE(TRIM(description), '') <> ''
  LOOP
    -- SKU único por empresa: PROD-XXXXXX incrementando em colisão.
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

  -- Transição para 'received' dispara triggers de estoque/financeiro.
  -- Se qualquer trigger falhar, a transação inteira sofre ROLLBACK.
  UPDATE public.purchases
     SET status = 'received',
         received_at = COALESCE(received_at, now()),
         updated_at = now()
   WHERE id = _purchase_id
   RETURNING * INTO v_purchase;

  RETURN v_purchase;
END;
$$;

REVOKE ALL ON FUNCTION public.receive_purchase(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase(uuid) TO service_role;
