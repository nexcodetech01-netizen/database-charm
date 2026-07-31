
CREATE OR REPLACE FUNCTION public.accounting_backfill(_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; _sales int := 0; _purchases int := 0; _tx int := 0; _cm int := 0;
  _cash_code text; _acct_type text; _counter_code text; _amount numeric; _discount numeric; _cogs numeric;
BEGIN
  FOR r IN SELECT * FROM public.sales
            WHERE company_id = _company_id AND NOT COALESCE(is_test,false)
              AND status IN ('pending','partially_paid','paid') LOOP
    PERFORM public.accounting_post_sale(r.id);
    _sales := _sales + 1;
  END LOOP;

  FOR r IN SELECT * FROM public.purchases
            WHERE company_id = _company_id AND received_at IS NOT NULL
              AND status <> 'cancelled' AND COALESCE(grand_total,0) > 0 LOOP
    PERFORM public.accounting_post_entry(
      r.company_id, r.purchase_date, 'Compra ' || COALESCE(r.number, r.id::text),
      'purchase', r.id, 'receipt', r.number,
      jsonb_build_array(
        jsonb_build_object('code','1.1.04','side','debit','amount', r.grand_total,'memo','Entrada de estoque'),
        jsonb_build_object('code','2.1.01','side','credit','amount', r.grand_total,'memo','Fornecedores')
      ));
    _purchases := _purchases + 1;
  END LOOP;

  FOR r IN SELECT * FROM public.financial_transactions
            WHERE company_id = _company_id AND status = 'paid' AND COALESCE(amount,0) > 0 LOOP
    SELECT type INTO _acct_type FROM public.financial_accounts WHERE id = r.account_id;
    _cash_code := CASE WHEN COALESCE(_acct_type,'cash') = 'cash' THEN '1.1.01' ELSE '1.1.02' END;
    _amount := ROUND(r.amount,2);
    _discount := ROUND(COALESCE(r.discount_amount,0),2);
    SELECT ac.code INTO _counter_code
      FROM public.financial_categories fc
      JOIN public.accounting_accounts ac ON ac.id = fc.accounting_account_id
     WHERE fc.id = r.category_id;

    IF r.type = 'income' THEN
      IF r.source IN ('sale','credit_payment','sale_cancellation') THEN _counter_code := '1.1.03';
      ELSE _counter_code := COALESCE(_counter_code,'8.1.02'); END IF;
      PERFORM public.accounting_post_entry(
        r.company_id, COALESCE(r.paid_at::date, r.transaction_date), 'Recebimento: ' || r.description,
        'financial_transaction', r.id, 'settlement', r.reference_number,
        jsonb_build_array(
          jsonb_build_object('code',_cash_code,'side','debit','amount', _amount - _discount,'memo','Entrada de caixa'),
          jsonb_build_object('code','4.2.01','side','debit','amount', _discount,'memo','Desconto concedido na baixa'),
          jsonb_build_object('code',_counter_code,'side','credit','amount', _amount,'memo','Baixa do recebível')
        ));
    ELSE
      IF r.source = 'purchase' THEN _counter_code := '2.1.01';
      ELSE _counter_code := COALESCE(_counter_code,'6.1.99'); END IF;
      PERFORM public.accounting_post_entry(
        r.company_id, COALESCE(r.paid_at::date, r.transaction_date), 'Pagamento: ' || r.description,
        'financial_transaction', r.id, 'settlement', r.reference_number,
        jsonb_build_array(
          jsonb_build_object('code',_counter_code,'side','debit','amount', _amount,'memo','Despesa/obrigação'),
          jsonb_build_object('code',_cash_code,'side','credit','amount', _amount - _discount,'memo','Saída de caixa'),
          jsonb_build_object('code','8.1.02','side','credit','amount', _discount,'memo','Desconto obtido')
        ));
    END IF;
    _tx := _tx + 1;
  END LOOP;

  FOR r IN SELECT cm.* FROM public.cash_movements cm
            WHERE cm.company_id = _company_id AND cm.transaction_id IS NULL AND COALESCE(cm.amount,0) > 0 LOOP
    IF r.type = 'cash_in' THEN
      PERFORM public.accounting_post_entry(r.company_id, r.created_at::date, 'Suprimento de caixa',
        'cash_movement', r.id, 'supply', NULL,
        jsonb_build_array(
          jsonb_build_object('code','1.1.01','side','debit','amount', r.amount,'memo', r.reason),
          jsonb_build_object('code','1.1.02','side','credit','amount', r.amount,'memo','Transferência de bancos')));
    ELSE
      PERFORM public.accounting_post_entry(r.company_id, r.created_at::date, 'Sangria de caixa',
        'cash_movement', r.id, 'withdraw', NULL,
        jsonb_build_array(
          jsonb_build_object('code','1.1.02','side','debit','amount', r.amount,'memo','Transferência para bancos'),
          jsonb_build_object('code','1.1.01','side','credit','amount', r.amount,'memo', r.reason)));
    END IF;
    _cm := _cm + 1;
  END LOOP;

  -- Vendas canceladas: garantir estorno contábil
  FOR r IN SELECT * FROM public.sales WHERE company_id = _company_id AND status = 'cancelled' LOOP
    PERFORM public.accounting_reverse_origin(r.company_id, 'sale', r.id, 'Venda cancelada');
  END LOOP;

  RETURN jsonb_build_object('sales', _sales, 'purchases', _purchases,
                            'transactions', _tx, 'cash_movements', _cm);
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_backfill(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounting_backfill(uuid) TO service_role;
