CREATE OR REPLACE FUNCTION public.create_sale_return(
  _company_id uuid,
  _sale_id uuid,
  _items jsonb,
  _restock_items boolean DEFAULT true,
  _settle_now boolean DEFAULT false,
  _account_id uuid DEFAULT NULL,
  _payment_method text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS public.sale_returns
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sale public.sales;
  v_return public.sale_returns;
  v_item record;
  v_sale_item record;
  v_total_amount numeric := 0;
  v_category_id uuid;
  v_transaction_id uuid;
BEGIN
  -- 1. Validar venda
  SELECT * INTO v_sale FROM public.sales WHERE id = _sale_id AND company_id = _company_id;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada.';
  END IF;

  -- 2. Garantir categoria "Estorno de Venda"
  SELECT id INTO v_category_id 
  FROM public.financial_categories 
  WHERE company_id = _company_id AND name IN ('Estorno de Venda', 'Reembolso') AND kind = 'expense'
  LIMIT 1;

  IF v_category_id IS NULL THEN
    INSERT INTO public.financial_categories (company_id, name, kind, color, icon)
    VALUES (_company_id, 'Estorno de Venda', 'expense', '#ef4444', 'RotateCcw')
    RETURNING id INTO v_category_id;
  END IF;

  -- 3. Criar a devolução
  INSERT INTO public.sale_returns (
    company_id, sale_id, total_amount, status, notes, created_by
  ) VALUES (
    _company_id, _sale_id, 0, 'completed', _notes, auth.uid()
  ) RETURNING * INTO v_return;

  -- 4. Processar itens
  FOR v_item IN SELECT * FROM jsonb_to_recordset(_items) AS x(sale_item_id uuid, quantity numeric, reason text, condition text)
  LOOP
    SELECT * INTO v_sale_item FROM public.sale_items WHERE id = v_item.sale_item_id;
    
    IF v_sale_item.id IS NULL THEN
      RAISE EXCEPTION 'Item da venda não encontrado: %', v_item.sale_item_id;
    END IF;

    INSERT INTO public.sale_return_items (
      company_id, return_id, sale_item_id, product_id, quantity, unit_price, subtotal, reason, condition
    ) VALUES (
      _company_id, v_return.id, v_item.sale_item_id, v_sale_item.product_id, 
      v_item.quantity, v_sale_item.unit_price, (v_item.quantity * v_sale_item.unit_price),
      v_item.reason, v_item.condition
    );

    v_total_amount := v_total_amount + (v_item.quantity * v_sale_item.unit_price);

    IF _restock_items AND v_item.condition = 'good' THEN
      UPDATE public.products 
      SET stock_quantity = stock_quantity + v_item.quantity 
      WHERE id = v_sale_item.product_id;
    END IF;
  END LOOP;

  UPDATE public.sale_returns SET total_amount = v_total_amount WHERE id = v_return.id;
  v_return.total_amount := v_total_amount;

  -- 6. Gerar lançamento financeiro saneado
  INSERT INTO public.financial_transactions (
    company_id, 
    account_id, 
    category_id, 
    type, 
    description, 
    amount, 
    transaction_date, 
    due_date,
    status,
    source,
    reference_id,
    reference_number,
    payment_method,
    paid_at,
    notes
  ) VALUES (
    _company_id,
    _account_id,
    v_category_id,
    'expense',
    'Estorno de Venda #' || v_sale.id,
    v_total_amount,
    CURRENT_DATE,
    CASE WHEN _settle_now THEN CURRENT_DATE ELSE CURRENT_DATE + interval '7 days' END,
    CASE WHEN _settle_now THEN 'paid' ELSE 'pending' END,
    'sale_return',
    v_return.id,
    v_sale.id::text,
    _payment_method,
    CASE WHEN _settle_now THEN now() ELSE NULL END,
    _notes
  ) RETURNING id INTO v_transaction_id;

  IF _settle_now AND _account_id IS NOT NULL THEN
    UPDATE public.financial_accounts 
    SET current_balance = current_balance - v_total_amount
    WHERE id = _account_id;
  END IF;

  RETURN v_return;
END;
$$;

-- Saneamento de dados
-- Apenas os que possuem account_id e payment_method
UPDATE public.financial_transactions
SET status = 'paid', paid_at = created_at
WHERE source = 'sale_return' 
  AND status IN ('pending', 'overdue')
  AND account_id IS NOT NULL
  AND payment_method IS NOT NULL
  AND created_at < now() - interval '1 hour';