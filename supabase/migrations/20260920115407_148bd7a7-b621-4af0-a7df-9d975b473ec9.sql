DO $deduplicate$
DECLARE
  v_duplicate RECORD;
  v_suffix integer;
  v_candidate text;
BEGIN
  FOR v_duplicate IN
    SELECT id, company_id, sku
      FROM (
        SELECT id,
               company_id,
               sku,
               row_number() OVER (
                 PARTITION BY company_id, sku
                 ORDER BY created_at NULLS LAST, id
               ) AS occurrence
          FROM public.products
         WHERE sku IS NOT NULL
           AND btrim(sku) <> ''
      ) ranked
     WHERE occurrence > 1
     ORDER BY company_id, sku, occurrence
  LOOP
    v_suffix := 2;
    LOOP
      v_candidate := v_duplicate.sku || '-DUP' || v_suffix;
      EXIT WHEN NOT EXISTS (
        SELECT 1
          FROM public.products
         WHERE company_id = v_duplicate.company_id
           AND sku = v_candidate
      );
      v_suffix := v_suffix + 1;
    END LOOP;

    UPDATE public.products
       SET sku = v_candidate,
           updated_at = now()
     WHERE id = v_duplicate.id;
  END LOOP;
END;
$deduplicate$;

CREATE UNIQUE INDEX products_company_sku_unique_idx
  ON public.products (company_id, sku)
  WHERE sku IS NOT NULL AND btrim(sku) <> '';

CREATE OR REPLACE FUNCTION public.reprocess_received_purchase(_purchase_id uuid)
RETURNS public.purchases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_item RECORD;
  v_new_product_id uuid;
  v_sku text;
  v_attempt integer;
  v_constraint_name text;
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

      v_attempt := 0;
      LOOP
        BEGIN
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
          EXIT;
        EXCEPTION WHEN unique_violation THEN
          GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
          IF v_constraint_name <> 'products_company_sku_unique_idx' OR v_attempt >= 4 THEN
            RAISE;
          END IF;
          v_attempt := v_attempt + 1;
          IF v_sku ~ '[0-9]+$' THEN
            v_sku := regexp_replace(
              v_sku,
              '[0-9]+$',
              lpad(((substring(v_sku FROM '([0-9]+)$'))::integer + 1)::text,
                   length(substring(v_sku FROM '([0-9]+)$')),
                   '0')
            );
          ELSE
            v_sku := v_sku || '-00' || (v_attempt + 1);
          END IF;
        END;
      END LOOP;
    END IF;

    UPDATE public.purchase_items
       SET product_id = v_new_product_id, updated_at = now()
     WHERE id = v_item.id;
  END LOOP;

  PERFORM set_config('app.purchase_reprocessing', 'true', true);

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

REVOKE ALL ON FUNCTION public.reprocess_received_purchase(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reprocess_received_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reprocess_received_purchase(uuid) TO service_role;