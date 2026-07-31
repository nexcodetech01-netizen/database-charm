
-- Helper: resolve conta financeira de destino para o Crediário
CREATE OR REPLACE FUNCTION public.credit_resolve_account(_company_id uuid, _method text, _account_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_method text := lower(coalesce(_method, 'cash'));
  v_is_cash boolean;
BEGIN
  IF _account_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.financial_accounts
     WHERE id = _account_id AND company_id = _company_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Conta de destino inválida.'; END IF;
    RETURN v_id;
  END IF;

  v_is_cash := v_method IN ('cash', 'dinheiro', 'especie', 'espécie');

  IF NOT v_is_cash THEN
    SELECT id INTO v_id FROM public.financial_accounts
     WHERE company_id = _company_id AND status = 'active' AND type <> 'cash'
     ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.financial_accounts
     WHERE company_id = _company_id AND status = 'active'
     ORDER BY (type = 'cash') DESC, created_at ASC LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'CONTA_FINANCEIRA_AUSENTE: cadastre uma conta financeira ativa antes de registrar recebimentos.';
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_resolve_account(uuid, text, uuid) TO authenticated, service_role;

-- create_credit_sale: entrada gera FT pendente e é baixada pelo motor
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
  IF v_down_payment < 0 OR v_down_payment > COALESCE(v_sale.grand_total,0) THEN
    RAISE EXCEPTION 'Valor da entrada inválido.';
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

    -- Lançamento em aberto: a baixa é feita exclusivamente pelo motor
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

-- receive_credit_payment: parcela gera FT pendente baixada pelo motor
CREATE OR REPLACE FUNCTION public.receive_credit_payment(_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid := NULLIF(_input->>'company_id','')::uuid;
  v_account_id uuid := NULLIF(_input->>'credit_account_id','')::uuid;
  v_amount numeric := COALESCE((_input->>'amount')::numeric, 0);
  v_method text := NULLIF(_input->>'payment_method','');
  v_paid_at timestamptz := NULLIF(_input->>'paid_at','')::timestamptz;
  v_notes text := NULLIF(_input->>'notes','');
  v_client_request_id uuid := NULLIF(_input->>'client_request_id','')::uuid;
  v_input_account_id uuid := NULLIF(_input->>'account_id','')::uuid;
  v_account public.credit_accounts%ROWTYPE;
  v_installment public.credit_installments%ROWTYPE;
  v_fin_account_id uuid;
  v_payment_id uuid;
  v_ft public.financial_transactions;
  v_ft_id uuid;
  v_new_balance numeric;
  v_apply numeric;
  v_existing uuid;
  v_effective_paid_at timestamptz;
BEGIN
  IF v_company_id IS NULL OR v_account_id IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'Dados de pagamento inválidos.'; END IF;
  IF NOT public.user_has_company_access(v_company_id) THEN RAISE EXCEPTION 'Acesso negado à empresa.' USING ERRCODE='42501'; END IF;
  IF v_client_request_id IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.credit_payments WHERE credit_account_id=v_account_id AND client_request_id=v_client_request_id LIMIT 1;
    IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('payment_id',v_existing,'idempotent',true); END IF;
  END IF;
  SELECT * INTO v_account FROM public.credit_accounts WHERE id=v_account_id AND company_id=v_company_id FOR UPDATE;
  IF v_account.id IS NULL THEN RAISE EXCEPTION 'Conta de crediário não encontrada.'; END IF;
  IF v_account.status NOT IN ('open','partially_paid') THEN RAISE EXCEPTION 'Conta não está aberta para recebimento.'; END IF;
  IF v_amount > v_account.balance THEN RAISE EXCEPTION 'Pagamento não pode exceder o saldo devedor.'; END IF;

  v_fin_account_id := public.credit_resolve_account(v_company_id, COALESCE(v_method,'cash'), v_input_account_id);

  SELECT * INTO v_installment FROM public.credit_installments WHERE credit_account_id=v_account_id AND status IN ('pending','partially_paid') ORDER BY sequence LIMIT 1 FOR UPDATE;

  -- Lançamento em aberto: a baixa é feita exclusivamente pelo motor
  INSERT INTO public.financial_transactions(company_id,type,description,amount,transaction_date,due_date,status,source,reference_number,created_by)
  VALUES(v_company_id,'income','Recebimento crediário',v_amount,COALESCE(v_paid_at,now())::date,COALESCE(v_paid_at,now())::date,'pending','credit_payment',NULL,auth.uid())
  RETURNING id INTO v_ft_id;

  INSERT INTO public.credit_payments(credit_account_id,installment_id,company_id,amount,payment_method,paid_at,notes,financial_transaction_id,kind,client_request_id,created_by)
  VALUES(v_account_id,v_installment.id,v_company_id,v_amount,COALESCE(v_method,'cash'),COALESCE(v_paid_at,now()),v_notes,v_ft_id,'installment',v_client_request_id,auth.uid())
  RETURNING id INTO v_payment_id;

  UPDATE public.financial_transactions SET reference_id=v_payment_id WHERE id=v_ft_id;

  v_ft := public.settle_financial_transaction(
    v_ft_id,
    COALESCE(v_method,'cash'),
    v_fin_account_id,
    v_paid_at,
    COALESCE(v_notes, 'Recebimento de crediário')
  );

  v_effective_paid_at := COALESCE(v_ft.paid_at, now());

  UPDATE public.credit_payments SET paid_at = v_effective_paid_at WHERE id = v_payment_id;

  IF v_installment.id IS NOT NULL THEN
    v_apply := LEAST(v_amount, GREATEST(v_installment.amount-v_installment.paid_amount,0));
    UPDATE public.credit_installments SET paid_amount=paid_amount+v_apply,status=CASE WHEN paid_amount+v_apply>=amount THEN 'paid' ELSE 'partially_paid' END,paid_at=CASE WHEN paid_amount+v_apply>=amount THEN v_effective_paid_at ELSE paid_at END,updated_at=now() WHERE id=v_installment.id;
  END IF;
  v_new_balance := GREATEST(v_account.balance-v_amount,0);
  UPDATE public.credit_accounts SET balance=v_new_balance,status=CASE WHEN v_new_balance=0 THEN 'settled' ELSE 'partially_paid' END,settled_at=CASE WHEN v_new_balance=0 THEN v_effective_paid_at ELSE NULL END,updated_at=now() WHERE id=v_account_id;
  UPDATE public.sales SET status=CASE WHEN v_new_balance=0 THEN 'paid' ELSE 'partially_paid' END,paid_at=CASE WHEN v_new_balance=0 THEN v_effective_paid_at ELSE paid_at END,updated_at=now() WHERE id=v_account.sale_id;
  INSERT INTO public.sale_events(sale_id,company_id,user_id,event_type,reason,payload)
  VALUES(v_account.sale_id,v_company_id,auth.uid(),'credit_payment','Pagamento de crediário recebido',jsonb_build_object('credit_account_id',v_account_id,'payment_id',v_payment_id,'amount',v_amount,'remaining_balance',v_new_balance));
  RETURN jsonb_build_object('payment_id',v_payment_id,'financial_transaction_id',v_ft_id,'balance',v_new_balance,'account_status',CASE WHEN v_new_balance=0 THEN 'settled' ELSE 'partially_paid' END,'idempotent',false);
END;
$function$;
