CREATE OR REPLACE FUNCTION public.find_existing_product(_company_id uuid, _name text, _sku text DEFAULT NULL, _barcode text DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.products p
   WHERE p.company_id = _company_id
     AND (
       (COALESCE(NULLIF(TRIM(_sku), ''), NULL) IS NOT NULL AND lower(TRIM(p.sku)) = lower(TRIM(_sku)))
       OR (COALESCE(NULLIF(TRIM(_barcode), ''), NULL) IS NOT NULL AND lower(TRIM(p.barcode)) = lower(TRIM(_barcode)))
       OR (COALESCE(NULLIF(TRIM(_name), ''), NULL) IS NOT NULL AND lower(regexp_replace(TRIM(p.name), '\s+', ' ', 'g')) = lower(regexp_replace(TRIM(_name), '\s+', ' ', 'g')))
     )
   ORDER BY
     CASE WHEN NULLIF(TRIM(_sku), '') IS NOT NULL AND lower(TRIM(p.sku)) = lower(TRIM(_sku)) THEN 0
          WHEN NULLIF(TRIM(_barcode), '') IS NOT NULL AND lower(TRIM(p.barcode)) = lower(TRIM(_barcode)) THEN 1
          ELSE 2 END,
     p.created_at
   LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.find_existing_product(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_existing_product(uuid, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.receive_purchase(_purchase_id uuid)
 RETURNS purchases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_item RECORD;
  v_new_product_id uuid;
  v_sku text;
BEGIN
  SELECT * INTO v_purchase FROM public.purchases WHERE id = _purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra % não encontrada.', _purchase_id;
  END IF;
  IF NOT public.user_has_company_access(v_purchase.company_id) THEN
    RAISE EXCEPTION 'Sem permissão para receber esta compra.' USING ERRCODE = '42501';
  END IF;
  IF v_purchase.status = 'received' THEN
    RETURN v_purchase;
  END IF;
  IF v_purchase.status = 'cancelled' THEN
    RAISE EXCEPTION 'Compra cancelada não pode ser recebida.';
  END IF;

  FOR v_item IN
    SELECT id, description, unit_price
      FROM public.purchase_items
     WHERE purchase_id = _purchase_id
       AND product_id IS NULL
       AND COALESCE(TRIM(description), '') <> ''
  LOOP
    v_new_product_id := public.find_existing_product(v_purchase.company_id, v_item.description, NULL, NULL);

    IF v_new_product_id IS NOT NULL THEN
      UPDATE public.products
         SET cost = COALESCE(v_item.unit_price, cost),
             updated_at = now()
       WHERE id = v_new_product_id;
    ELSE
      v_sku := public.generate_product_sku(v_purchase.company_id, v_item.description, NULL);
      IF v_sku IS NULL OR v_sku = '' THEN
        RAISE EXCEPTION 'Falha ao gerar SKU para item "%".', v_item.description;
      END IF;

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
    END IF;

    UPDATE public.purchase_items
       SET product_id = v_new_product_id, updated_at = now()
     WHERE id = v_item.id;
  END LOOP;

  UPDATE public.purchases
     SET status = 'received',
         received_at = COALESCE(received_at, now()),
         updated_at = now()
   WHERE id = _purchase_id
   RETURNING * INTO v_purchase;

  RETURN v_purchase;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reprocess_received_purchase(_purchase_id uuid)
 RETURNS purchases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_item RECORD;
  v_new_product_id uuid;
  v_sku text;
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
    RETURN v_purchase;
  END IF;

  FOR v_item IN
    SELECT id, description, unit_price
      FROM public.purchase_items
     WHERE purchase_id = _purchase_id
       AND product_id IS NULL
       AND COALESCE(TRIM(description), '') <> ''
  LOOP
    v_new_product_id := public.find_existing_product(v_purchase.company_id, v_item.description, NULL, NULL);

    IF v_new_product_id IS NOT NULL THEN
      UPDATE public.products
         SET cost = COALESCE(v_item.unit_price, cost),
             updated_at = now()
       WHERE id = v_new_product_id;
    ELSE
      v_sku := public.generate_product_sku(v_purchase.company_id, v_item.description, NULL);
      IF v_sku IS NULL OR v_sku = '' THEN
        RAISE EXCEPTION 'Falha ao gerar SKU para item "%".', v_item.description;
      END IF;

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
    END IF;

    UPDATE public.purchase_items
       SET product_id = v_new_product_id, updated_at = now()
     WHERE id = v_item.id;
  END LOOP;

  UPDATE public.purchases SET status = 'pending' WHERE id = _purchase_id;
  UPDATE public.purchases
     SET status = 'received',
         received_at = COALESCE(received_at, now()),
         updated_at = now()
   WHERE id = _purchase_id
   RETURNING * INTO v_purchase;

  RETURN v_purchase;
END;
$function$;