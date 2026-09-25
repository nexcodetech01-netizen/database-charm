CREATE OR REPLACE FUNCTION public.apply_pdv_payment_pricing(
  _sale_id uuid,
  _payment_method text,
  _installments integer,
  _cash_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_fee numeric := 2.88;
  v_max_installments integer := 3;
  v_active boolean := true;
  v_installments integer := 1;
  v_items_total numeric := 0;
  v_grand_total numeric := 0;
  v_expected integer := 0;
  v_updated integer := 0;
BEGIN
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = _sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada.';
  END IF;
  IF NOT public.user_has_company_access(v_sale.company_id) THEN
    RAISE EXCEPTION 'Sem acesso à empresa desta venda.';
  END IF;
  IF v_sale.status NOT IN ('draft', 'pending') THEN
    RAISE EXCEPTION 'A forma de pagamento não pode ser alterada após a confirmação da venda.';
  END IF;
  IF jsonb_typeof(_cash_items) <> 'array' OR jsonb_array_length(_cash_items) = 0 THEN
    RAISE EXCEPTION 'Informe os itens da venda.';
  END IF;

  SELECT card_fee_percent, max_installments, active
  INTO v_fee, v_max_installments, v_active
  FROM public.company_card_price_config
  WHERE company_id = v_sale.company_id;

  v_fee := COALESCE(v_fee, 2.88);
  v_max_installments := COALESCE(v_max_installments, 3);
  v_active := COALESCE(v_active, true);
  v_installments := CASE
    WHEN _payment_method = 'credit_card' THEN LEAST(GREATEST(COALESCE(_installments, 1), 1), v_max_installments)
    ELSE 1
  END;

  SELECT count(*) INTO v_expected FROM public.sale_items WHERE sale_id = _sale_id;

  WITH cash_prices AS (
    SELECT
      (item->>'product_id')::uuid AS product_id,
      GREATEST(0, (item->>'unit_price')::numeric) AS cash_unit_price
    FROM jsonb_array_elements(_cash_items) AS item
    WHERE item ? 'product_id' AND item ? 'unit_price'
  ), changed AS (
    UPDATE public.sale_items si
    SET unit_price = CASE
          WHEN _payment_method = 'credit_card' AND v_active AND v_fee > 0
            THEN ceil((cp.cash_unit_price / (1 - v_fee / 100)) * 100) / 100
          ELSE cp.cash_unit_price
        END,
        total = GREATEST(
          0,
          si.quantity * CASE
            WHEN _payment_method = 'credit_card' AND v_active AND v_fee > 0
              THEN ceil((cp.cash_unit_price / (1 - v_fee / 100)) * 100) / 100
            ELSE cp.cash_unit_price
          END - COALESCE(si.discount, 0)
        )
    FROM cash_prices cp
    WHERE si.sale_id = _sale_id AND si.product_id = cp.product_id
    RETURNING si.id
  )
  SELECT count(*) INTO v_updated FROM changed;

  IF v_updated <> v_expected THEN
    RAISE EXCEPTION 'Não foi possível atualizar todos os itens da venda.';
  END IF;

  SELECT COALESCE(sum(total), 0) INTO v_items_total
  FROM public.sale_items
  WHERE sale_id = _sale_id;
  v_grand_total := GREATEST(0, v_items_total - COALESCE(v_sale.discount, 0) + COALESCE(v_sale.shipping, 0));

  UPDATE public.sales
  SET payment_method = CASE WHEN _payment_method = 'pending_payment' THEN NULL ELSE _payment_method END,
      installments = v_installments,
      items_total = v_items_total,
      grand_total = v_grand_total,
      updated_at = now()
  WHERE id = _sale_id;

  RETURN jsonb_build_object(
    'sale_id', _sale_id,
    'items_total', v_items_total,
    'grand_total', v_grand_total,
    'payment_method', _payment_method,
    'installments', v_installments
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_pdv_payment_pricing(uuid, text, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_pdv_payment_pricing(uuid, text, integer, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_pdv_payment_pricing(uuid, text, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_pdv_payment_pricing(uuid, text, integer, jsonb) TO service_role;