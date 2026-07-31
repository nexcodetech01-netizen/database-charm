CREATE OR REPLACE FUNCTION public.create_sale_return(_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id        UUID   := (_input->>'company_id')::uuid;
  v_sale_id           UUID   := (_input->>'sale_id')::uuid;
  v_reason            TEXT   := trim(coalesce(_input->>'reason', ''));
  v_notes             TEXT   := NULLIF(_input->>'notes','');
  v_client_request_id UUID   := NULLIF(_input->>'client_request_id','')::uuid;
  v_items             jsonb  := coalesce(_input->'items','[]'::jsonb);
  v_input_account_id  UUID   := NULLIF(_input->>'account_id','')::uuid;
  v_refund_method     TEXT   := NULLIF(_input->>'refund_method','');

  v_sale              RECORD;
  v_existing_id       UUID;
  v_return_id         UUID;
  v_return_number     TEXT;
  v_total             NUMERIC := 0;
  v_is_cash           BOOLEAN;
  v_is_digital        BOOLEAN;
  v_refund_status     TEXT;
  v_bella_charge_id   UUID;
  v_finance_id        UUID;
  v_fin_account_id    UUID;
  v_settle_now        BOOLEAN;
  v_method            TEXT;
  v_stamp             TEXT;
BEGIN
  IF v_company_id IS NULL OR v_sale_id IS NULL THEN
    RAISE EXCEPTION 'company_id e sale_id são obrigatórios';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'Motivo obrigatório.';
  END IF;

  IF jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um item para devolução.';
  END IF;

  IF v_client_request_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
      FROM public.sale_returns
     WHERE sale_id = v_sale_id
       AND client_request_id = v_client_request_id
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('return_id', v_existing_id, 'idempotent', true);
    END IF;
  END IF;

  SELECT id, company_id, number, payment_method, bella_pay_ref, grand_total
    INTO v_sale
    FROM public.sales
   WHERE id = v_sale_id
   FOR UPDATE;

  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada.';
  END IF;

  SELECT COALESCE(SUM(
           GREATEST(0, (elem->>'quantity')::numeric)
         * GREATEST(0, (elem->>'unit_price')::numeric)
         ), 0)
    INTO v_total
    FROM jsonb_array_elements(v_items) AS elem
   WHERE (elem->>'quantity')::numeric > 0;

  v_is_cash    := v_sale.payment_method = 'cash';
  v_is_digital := v_sale.payment_method IN ('pix','credit_card','debit_card','payment_link','card','bella_pay');
  v_refund_status := CASE WHEN v_is_digital THEN 'requested' ELSE 'not_required' END;

  IF v_sale.bella_pay_ref IS NOT NULL THEN
    SELECT id INTO v_bella_charge_id
      FROM public.bella_pay_charges
     WHERE sale_id = v_sale.id
     ORDER BY created_at DESC
     LIMIT 1;
  END IF;

  v_stamp := to_char(now() AT TIME ZONE 'utc', 'YYYYMMDDHH24MISS');
  v_return_number := 'DEV-' || COALESCE(v_sale.number, v_sale.id::text) || '-' || v_stamp;

  INSERT INTO public.sale_returns(
    company_id, sale_id, number, reason, notes,
    total_value, status, refund_status, bella_pay_charge_id,
    client_request_id
  ) VALUES (
    v_company_id, v_sale.id, v_return_number, v_reason, v_notes,
    v_total, 'completed', v_refund_status, v_bella_charge_id,
    v_client_request_id
  )
  RETURNING id INTO v_return_id;

  INSERT INTO public.sale_return_items(
    return_id, sale_item_id, product_id, description, quantity, unit_price, total
  )
  SELECT
    v_return_id,
    NULLIF(elem->>'sale_item_id','')::uuid,
    NULLIF(elem->>'product_id','')::uuid,
    elem->>'description',
    (elem->>'quantity')::numeric,
    (elem->>'unit_price')::numeric,
    GREATEST(0, (elem->>'quantity')::numeric) * GREATEST(0, (elem->>'unit_price')::numeric)
  FROM jsonb_array_elements(v_items) AS elem
  WHERE (elem->>'quantity')::numeric > 0;

  INSERT INTO public.inventory_movements(
    company_id, product_id, type, quantity,
    reason, notes, movement_date,
    source, reference_id, reference_number
  )
  SELECT
    v_company_id,
    (elem->>'product_id')::uuid,
    'in',
    (elem->>'quantity')::numeric,
    'Devolução de venda',
    'Devolução ' || v_return_number || ' — venda ' || COALESCE(v_sale.number, v_sale.id::text),
    now(),
    'sale_return',
    v_return_id,
    v_return_number
  FROM jsonb_array_elements(v_items) AS elem
  WHERE (elem->>'quantity')::numeric > 0
    AND NULLIF(elem->>'product_id','') IS NOT NULL;

  -- 4) Financeiro: motor único de liquidação.
  --    Sempre cria o lançamento PENDENTE. A baixa é feita exclusivamente
  --    por settle_financial_transaction(). Devoluções dependentes de
  --    gateway (Bella Pay) permanecem pendentes até o webhook confirmar.
  IF v_total > 0 THEN
    v_method := COALESCE(v_refund_method, v_sale.payment_method, 'cash');
    v_settle_now := (v_bella_charge_id IS NULL)
                    AND (v_is_cash OR v_method IN ('cash','pix','debit_card'));

    INSERT INTO public.financial_transactions(
      company_id, type, description, amount,
      transaction_date, due_date, status,
      source, reference_id, reference_number
    ) VALUES (
      v_company_id, 'expense',
      'Devolução venda ' || COALESCE(v_sale.number, v_sale.id::text),
      v_total,
      CURRENT_DATE, CURRENT_DATE, 'pending',
      'sale_return', v_return_id, v_return_number
    )
    RETURNING id INTO v_finance_id;

    UPDATE public.sale_returns
       SET finance_ref = v_finance_id
     WHERE id = v_return_id;

    IF v_settle_now THEN
      v_fin_account_id := public.credit_resolve_account(v_company_id, v_method, v_input_account_id);

      PERFORM public.settle_financial_transaction(
        v_finance_id,
        v_method,
        v_fin_account_id,
        NULL,
        'Devolução ' || v_return_number
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'return_id', v_return_id,
    'financial_transaction_id', v_finance_id,
    'settled', COALESCE(v_settle_now, false),
    'idempotent', false
  );
END;
$function$;