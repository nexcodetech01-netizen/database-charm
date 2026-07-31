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
  v_paid_at timestamptz := COALESCE(NULLIF(_input->>'paid_at','')::timestamptz, now());
  v_notes text := NULLIF(_input->>'notes','');
  v_client_request_id uuid := NULLIF(_input->>'client_request_id','')::uuid;
  v_account public.credit_accounts%ROWTYPE;
  v_installment public.credit_installments%ROWTYPE;
  v_payment_id uuid;
  v_ft_id uuid;
  v_new_balance numeric;
  v_apply numeric;
  v_existing uuid;
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
  SELECT * INTO v_installment FROM public.credit_installments WHERE credit_account_id=v_account_id AND status IN ('pending','partially_paid') ORDER BY sequence LIMIT 1 FOR UPDATE;
  INSERT INTO public.financial_transactions(company_id,type,description,amount,transaction_date,due_date,paid_at,status,source,reference_number,created_by)
  VALUES(v_company_id,'income','Recebimento crediário',v_amount,v_paid_at::date,v_paid_at::date,v_paid_at,'paid','credit_payment',NULL,auth.uid()) RETURNING id INTO v_ft_id;
  INSERT INTO public.credit_payments(credit_account_id,installment_id,company_id,amount,payment_method,paid_at,notes,financial_transaction_id,kind,client_request_id,created_by)
  VALUES(v_account_id,v_installment.id,v_company_id,v_amount,COALESCE(v_method,'cash'),v_paid_at,v_notes,v_ft_id,'installment',v_client_request_id,auth.uid()) RETURNING id INTO v_payment_id;
  UPDATE public.financial_transactions SET reference_id=v_payment_id WHERE id=v_ft_id;
  IF v_installment.id IS NOT NULL THEN
    v_apply := LEAST(v_amount, GREATEST(v_installment.amount-v_installment.paid_amount,0));
    UPDATE public.credit_installments SET paid_amount=paid_amount+v_apply,status=CASE WHEN paid_amount+v_apply>=amount THEN 'paid' ELSE 'partially_paid' END,paid_at=CASE WHEN paid_amount+v_apply>=amount THEN v_paid_at ELSE paid_at END,updated_at=now() WHERE id=v_installment.id;
  END IF;
  v_new_balance := GREATEST(v_account.balance-v_amount,0);
  UPDATE public.credit_accounts SET balance=v_new_balance,status=CASE WHEN v_new_balance=0 THEN 'settled' ELSE 'partially_paid' END,settled_at=CASE WHEN v_new_balance=0 THEN v_paid_at ELSE NULL END,updated_at=now() WHERE id=v_account_id;
  UPDATE public.sales SET status=CASE WHEN v_new_balance=0 THEN 'paid' ELSE 'partially_paid' END,paid_at=CASE WHEN v_new_balance=0 THEN v_paid_at ELSE paid_at END,updated_at=now() WHERE id=v_account.sale_id;
  INSERT INTO public.sale_events(sale_id,company_id,user_id,event_type,reason,payload)
  VALUES(v_account.sale_id,v_company_id,auth.uid(),'credit_payment','Pagamento de crediário recebido',jsonb_build_object('credit_account_id',v_account_id,'payment_id',v_payment_id,'amount',v_amount,'remaining_balance',v_new_balance));
  RETURN jsonb_build_object('payment_id',v_payment_id,'financial_transaction_id',v_ft_id,'balance',v_new_balance,'account_status',CASE WHEN v_new_balance=0 THEN 'settled' ELSE 'partially_paid' END,'idempotent',false);
END;
$function$;