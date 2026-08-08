-- Adiciona validação de entrada no crediário (RPC create_credit_sale)
-- Garante que a entrada não seja negativa nem maior que o total da venda

CREATE OR REPLACE FUNCTION public.create_credit_sale(_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid := NULLIF(_input->>'company_id','')::uuid;
  v_sale_id uuid := NULLIF(_input->>'sale_id','')::uuid;
  v_customer_id uuid := NULLIF(_input->>'customer_id','')::uuid;
  v_down_payment numeric := COALESCE((_input->>'down_payment')::numeric, 0);
  v_down_method text := NULLIF(_input->>'down_payment_method','');
  v_due_date date := NULLIF(_input->>'due_date','')::date;
  v_notes text := NULLIF(_input->>'notes','');
  v_client_request_id uuid := NULLIF(_input->>'client_request_id','')::uuid;
  v_input_account_id uuid := NULLIF(_input->>'account_id','')::uuid;
  v_sale public.sales%ROWTYPE;
  v_account_id uuid;
  v_fin_account_id uuid;
  v_installment_id uuid;
  v_payment_id uuid;
  v_ft_id uuid;
  v_balance numeric;
BEGIN
  IF v_company_id IS NULL OR v_sale_id IS NULL THEN
    RAISE EXCEPTION 'company_id e sale_id são obrigatórios.';
  END IF;

  IF NOT public.user_has_company_access(v_company_id) THEN
    RAISE EXCEPTION 'Acesso negado à empresa.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = v_sale_id AND company_id = v_company_id FOR UPDATE;
  IF v_sale.id IS NULL THEN RAISE EXCEPTION 'Venda não encontrada.'; END IF;

  v_customer_id := COALESCE(v_customer_id, v_sale.customer_id);
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Selecione um cliente para usar o crediário.'; END IF;

  -- Validação de Segurança: Valor da entrada
  IF v_down_payment < 0 THEN
    RAISE EXCEPTION 'O valor da entrada não pode ser negativo.';
  END IF;

  IF v_down_payment > COALESCE(v_sale.grand_total, 0) THEN
    RAISE EXCEPTION 'A entrada não pode ser maior que o total da venda.';
  END IF;

  v_balance := GREATEST(COALESCE(v_sale.grand_total,0) - v_down_payment, 0);

  IF v_client_request_id IS NOT NULL THEN
    SELECT id INTO v_account_id FROM public.credit_accounts WHERE sale_id = v_sale_id LIMIT 1;
    IF v_account_id IS NOT NULL THEN
      RETURN jsonb_build_object('credit_account_id', v_account_id, 'idempotent', true);
    END IF;
  END IF;

  INSERT INTO public.credit_accounts(company_id,sale_id,customer_id,original_amount,down_payment,balance,status,due_date,notes,created_by)
  VALUES (v_company_id,v_sale_id,v_customer_id,v_sale.grand_total,v_down_payment,v_balance,CASE WHEN v_balance=0 THEN 'settled' ELSE 'open' END,v_due_date,v_notes,auth.uid())
  RETURNING id INTO v_account_id;

  IF v_balance > 0 THEN
    INSERT INTO public.credit_installments(credit_account_id,company_id,sequence,amount,paid_amount,due_date,status)
    VALUES(v_account_id,v_company_id,1,v_balance,0,v_due_date,'pending') RETURNING id INTO v_installment_id;
  END IF;

  IF v_down_payment > 0 THEN
    v_fin_account_id := public.credit_resolve_account(v_company_id, COALESCE(v_down_method,'cash'), v_input_account_id);

    INSERT INTO public.financial_transactions(company_id,type,description,amount,transaction_date,due_date,status,source,reference_id,reference_number,created_by)
    VALUES(v_company_id,'income','Entrada crediário venda '||COALESCE(v_sale.number,v_sale.id::text),v_down_payment,CURRENT_DATE,CURRENT_DATE,'pending','credit_payment',v_sale_id,v_sale.number,auth.uid())
    RETURNING id INTO v_ft_id;

    INSERT INTO public.credit_payments(credit_account_id,company_id,amount,payment_method,paid_at,notes,financial_transaction_id,kind,client_request_id,created_by)
    VALUES(v_account_id,v_company_id,v_down_payment,COALESCE(v_down_method,'cash'),now(),'Entrada da venda',v_ft_id,'down_payment',v_client_request_id,auth.uid())
    RETURNING id INTO v_payment_id;

    UPDATE public.financial_transactions SET reference_id=v_payment_id WHERE id=v_ft_id;

    PERFORM public.settle_financial_transaction(
      v_ft_id,
      COALESCE(v_down_method,'cash'),
      v_fin_account_id,
      NULL,
      'Entrada de crediário'
    );

    UPDATE public.credit_payments cp
       SET paid_at = ft.paid_at
      FROM public.financial_transactions ft
     WHERE cp.id = v_payment_id AND ft.id = v_ft_id;
  END IF;

  UPDATE public.sales SET payment_method='credit', status=CASE WHEN v_balance=0 THEN 'paid' ELSE 'partially_paid' END, paid_at=CASE WHEN v_balance=0 THEN now() ELSE paid_at END, updated_at=now() WHERE id=v_sale_id;

  INSERT INTO public.sale_events(sale_id,company_id,user_id,event_type,reason,payload)
  VALUES(v_sale_id,v_company_id,auth.uid(),'credit_created','Crediário criado',jsonb_build_object('credit_account_id',v_account_id,'down_payment',v_down_payment,'balance',v_balance));

  RETURN jsonb_build_object('credit_account_id',v_account_id,'installment_id',v_installment_id,'down_payment_id',v_payment_id,'financial_transaction_id',v_ft_id,'balance',v_balance,'idempotent',false);
END;
$function$;
