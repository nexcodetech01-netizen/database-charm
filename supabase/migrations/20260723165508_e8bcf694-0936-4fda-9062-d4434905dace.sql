
DO $$
DECLARE
  p RECORD;
  it RECORD;
  new_pid uuid;
  base text; s text; n int;
BEGIN
  FOR p IN
    SELECT id, company_id, supplier_id
      FROM public.purchases
     WHERE status = 'received' AND COALESCE(stock_applied, false) = false
  LOOP
    -- Cria produtos faltantes
    FOR it IN
      SELECT id, description, unit_price
        FROM public.purchase_items
       WHERE purchase_id = p.id
         AND product_id IS NULL
         AND COALESCE(TRIM(description),'') <> ''
    LOOP
      base := 'PROD-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text,'-','') FROM 1 FOR 6));
      s := base; n := 1;
      WHILE EXISTS (SELECT 1 FROM public.products WHERE company_id = p.company_id AND sku = s) LOOP
        n := n + 1; s := base || '-' || n;
      END LOOP;

      INSERT INTO public.products (company_id, name, sku, supplier_id, cost, stock, status)
      VALUES (p.company_id, it.description, s, p.supplier_id, COALESCE(it.unit_price, 0), 0, 'active')
      RETURNING id INTO new_pid;

      UPDATE public.purchase_items SET product_id = new_pid, updated_at = now() WHERE id = it.id;
    END LOOP;

    -- Bounce para disparar apply_purchase_to_inventory / apply_purchase_to_finance
    UPDATE public.purchases SET status = 'pending' WHERE id = p.id;
    UPDATE public.purchases
       SET status = 'received',
           received_at = COALESCE(received_at, now()),
           updated_at = now()
     WHERE id = p.id;
  END LOOP;
END $$;
