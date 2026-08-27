-- BUG ATIVO ENCONTRADO E CORRIGIDO (2026-08-26): "A Receber" inflado
-- e cobrança dupla quando uma venda vira crediário com entrada.
--
-- `create_credit_sale` faz tudo certo pra entrada (cria o pagamento,
-- marca como pago, gera a parcela do saldo restante em
-- `credit_installments`) — mas NUNCA cancela o lançamento financeiro
-- ORIGINAL da venda (o que já existia desde que a venda virou "a
-- receber", ligado via `sales.finance_ref`). Resultado: passam a
-- existir DOIS registros representando a MESMA dívida ao mesmo
-- tempo — o antigo (valor cheio, "pendente", nunca atualizado) e o
-- novo (só o saldo restante, via crediário). Isso:
-- 1. Infla o total de "A Receber" (soma os dois, contando a entrada
--    duas vezes: uma como já paga, outra ainda como se estivesse em
--    aberto no valor cheio original);
-- 2. Faz o botão "Receber" no lançamento antigo cobrar o valor CHEIO
--    de novo, ignorando a entrada já dada pelo cliente.
--
-- Corrigido: depois de criar a entrada, a função agora CANCELA o
-- lançamento original da venda (mesmo padrão/status 'refunded' já
-- usado em `reverse_sale_finance`, pra manter consistência) — daqui
-- pra frente, quem vira fonte da verdade do saldo restante é só o
-- crediário (`credit_installments`), sem duplicar.

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
  v_original_ft_id uuid;
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

  -- CORREÇÃO (2026-08-26): cancela o lançamento financeiro ORIGINAL
  -- da venda (o que já existia desde que ela virou "a receber"), pra
  -- não ficar duplicado com o saldo agora controlado pelo crediário.
  -- Sem isso, o "A Receber" contava a entrada (paga) E o valor cheio
  -- original (ainda pendente) ao mesmo tempo — e o botão "Receber" no
  -- lançamento antigo cobrava o valor cheio de novo, ignorando a
  -- entrada já dada.
  SELECT id INTO v_original_ft_id
  FROM public.financial_transactions
  WHERE (id = v_sale.finance_ref OR (source = 'sale' AND reference_id = v_sale_id))
    AND status IN ('pending', 'overdue', 'partial')
  LIMIT 1;

  IF v_original_ft_id IS NOT NULL THEN
    UPDATE public.financial_transactions
       SET status = 'refunded',
           notes = btrim(COALESCE(notes || E'\n', '') ||
             format('[crediário %s] lançamento original cancelado — saldo passou a ser controlado pelas parcelas do crediário.', to_char(now(), 'YYYY-MM-DD HH24:MI'))),
           updated_at = now()
     WHERE id = v_original_ft_id;
  END IF;

  -- CORREÇÃO 2 (2026-08-26): sem isso, cancelar o lançamento original
  -- (acima) faz o saldo restante do crediário DESAPARECER de "A
  -- Receber" por completo — o saldo passa a existir só dentro do
  -- módulo de Crediário, invisível no resumo financeiro geral. Cria
  -- um lançamento NOVO, com o valor CERTO (só o saldo restante, não o
  -- total original), ligado à parcela do crediário — assim o "A
  -- Receber" mostra o valor real que falta receber, sem duplicar nem
  -- esconder.
  IF v_balance > 0 AND v_installment_id IS NOT NULL THEN
    INSERT INTO public.financial_transactions(
      company_id, type, description, amount, transaction_date, due_date,
      status, source, reference_id, reference_number, created_by
    )
    VALUES (
      v_company_id, 'income',
      'Venda Nº ' || COALESCE(v_sale.number, v_sale.id::text) || ' — Saldo do crediário',
      v_balance, CURRENT_DATE, v_due_date,
      'pending', 'credit_payment', v_installment_id, v_sale.number, auth.uid()
    );
  END IF;

  UPDATE public.sales SET payment_method='credit', status=CASE WHEN v_balance=0 THEN 'paid' ELSE 'partially_paid' END, paid_at=CASE WHEN v_balance=0 THEN now() ELSE paid_at END, updated_at=now() WHERE id=v_sale_id;

  INSERT INTO public.sale_events(sale_id,company_id,user_id,event_type,reason,payload)
  VALUES(v_sale_id,v_company_id,auth.uid(),'credit_created','Crediário criado',jsonb_build_object('credit_account_id',v_account_id,'down_payment',v_down_payment,'balance',v_balance));

  RETURN jsonb_build_object('credit_account_id',v_account_id,'installment_id',v_installment_id,'down_payment_id',v_payment_id,'financial_transaction_id',v_ft_id,'balance',v_balance,'idempotent',false);
END;
$function$;

-- SEGUNDA PARTE DA CORREÇÃO (2026-08-26): sem isso, pagar uma parcela
-- pela tela CERTA de Crediário nunca avisaria o lançamento de "saldo
-- do crediário" criado acima — ele ficaria "pendente" pra sempre,
-- mesmo já pago, recriando o mesmo tipo de problema de novo (dinheiro
-- contado a mais em "A Receber"). Agora, ao registrar um pagamento:
-- se a parcela ficou totalmente paga, cancela o lançamento de
-- visibilidade; se ficou só parcialmente paga, ajusta o valor dele
-- pro que realmente ainda falta — sempre refletindo a realidade.
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
  v_installment_status text;
  v_installment_remaining numeric;
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
    UPDATE public.credit_installments
       SET paid_amount=paid_amount+v_apply,
           status=CASE WHEN paid_amount+v_apply>=amount THEN 'paid' ELSE 'partially_paid' END,
           paid_at=CASE WHEN paid_amount+v_apply>=amount THEN v_effective_paid_at ELSE paid_at END,
           updated_at=now()
     WHERE id=v_installment.id
     RETURNING status, GREATEST(amount - paid_amount, 0) INTO v_installment_status, v_installment_remaining;

    -- Sincroniza o lançamento de "saldo do crediário" (criado em
    -- `create_credit_sale`) com o que realmente aconteceu aqui.
    IF v_installment_status = 'paid' THEN
      UPDATE public.financial_transactions
         SET status = 'refunded',
             notes = btrim(COALESCE(notes || E'\n', '') ||
               format('[crediário %s] parcela quitada via tela de Crediário — lançamento de visibilidade encerrado.', to_char(now(), 'YYYY-MM-DD HH24:MI'))),
             updated_at = now()
       WHERE source = 'credit_payment'
         AND reference_id = v_installment.id
         AND status = 'pending'
         AND id <> v_ft_id;
    ELSE
      UPDATE public.financial_transactions
         SET amount = v_installment_remaining,
             updated_at = now()
       WHERE source = 'credit_payment'
         AND reference_id = v_installment.id
         AND status = 'pending'
         AND id <> v_ft_id;
    END IF;
  END IF;
  v_new_balance := GREATEST(v_account.balance-v_amount,0);
  UPDATE public.credit_accounts SET balance=v_new_balance,status=CASE WHEN v_new_balance=0 THEN 'settled' ELSE 'partially_paid' END,settled_at=CASE WHEN v_new_balance=0 THEN v_effective_paid_at ELSE NULL END,updated_at=now() WHERE id=v_account_id;
  UPDATE public.sales SET status=CASE WHEN v_new_balance=0 THEN 'paid' ELSE 'partially_paid' END,paid_at=CASE WHEN v_new_balance=0 THEN v_effective_paid_at ELSE paid_at END,updated_at=now() WHERE id=v_account.sale_id;
  INSERT INTO public.sale_events(sale_id,company_id,user_id,event_type,reason,payload)
  VALUES(v_account.sale_id,v_company_id,auth.uid(),'credit_payment','Pagamento de crediário recebido',jsonb_build_object('credit_account_id',v_account_id,'payment_id',v_payment_id,'amount',v_amount,'remaining_balance',v_new_balance));
  RETURN jsonb_build_object('payment_id',v_payment_id,'financial_transaction_id',v_ft_id,'balance',v_new_balance,'account_status',CASE WHEN v_new_balance=0 THEN 'settled' ELSE 'partially_paid' END,'idempotent',false);
END;
$function$;

-- TERCEIRA PARTE DA CORREÇÃO (2026-08-26): se alguém clicar "Receber"
-- DIRETO no Financeiro (em vez de pela tela de Crediário) no
-- lançamento de "saldo do crediário" criado acima, isso precisa
-- avisar o Crediário — senão a parcela continuaria pendente lá pra
-- sempre, mesmo já recebida, causando o problema inverso do que já
-- corrigimos (Financeiro certo, Crediário desatualizado).
CREATE OR REPLACE FUNCTION public.settle_financial_transaction(
  _transaction_id uuid,
  _payment_method text,
  _account_id uuid,
  _paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _notes text DEFAULT NULL::text,
  _settled_amount numeric DEFAULT NULL::numeric
)
 RETURNS financial_transactions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.financial_transactions;
  v_account public.financial_accounts;
  v_session public.cash_sessions;
  v_original numeric;
  v_amount numeric;
  v_discount numeric;
  v_paid_at timestamptz;
  v_sale public.sales%ROWTYPE;
  v_notes text;
  v_installment public.credit_installments%ROWTYPE;
  v_credit_account public.credit_accounts%ROWTYPE;
  v_new_balance numeric;
BEGIN
  v_paid_at := COALESCE(_paid_at, now());

  SELECT * INTO v_tx FROM public.financial_transactions WHERE id = _transaction_id;
  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Lançamento financeiro não encontrado.';
  END IF;
  IF v_tx.status = 'paid' THEN
    RAISE EXCEPTION 'Este lançamento já está baixado.';
  END IF;

  SELECT * INTO v_account FROM public.financial_accounts WHERE id = _account_id;
  IF v_account.id IS NULL OR v_account.company_id <> v_tx.company_id THEN
    RAISE EXCEPTION 'Conta de destino inválida.';
  END IF;

  v_original := COALESCE(v_tx.amount, 0);
  v_amount := ROUND(COALESCE(_settled_amount, v_original), 2);

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'VALOR_INVALIDO: o valor liquidado deve ser maior que zero.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_amount > v_original * 2 THEN
    RAISE EXCEPTION 'VALOR_INVALIDO: o valor liquidado não pode exceder o dobro do valor original.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_discount := ROUND(v_original - v_amount, 2);

  v_notes := NULLIF(btrim(COALESCE(_notes, '')), '');
  IF v_discount <> 0 THEN
    v_notes := btrim(
      COALESCE(v_notes || ' · ', '') ||
      CASE WHEN v_discount > 0
        THEN 'Desconto concedido na baixa: ' || to_char(v_discount, 'FM999999990.00')
        ELSE 'Acréscimo cobrado na baixa: ' || to_char(-v_discount, 'FM999999990.00')
      END ||
      ' (valor original ' || to_char(v_original, 'FM999999990.00') || ')'
    );
  END IF;

  IF v_account.type = 'cash' THEN
    -- Prioridade 1: sessão aberta do próprio operador que está baixando.
    SELECT * INTO v_session
    FROM public.cash_sessions
    WHERE company_id = v_tx.company_id AND status = 'open' AND created_by = auth.uid()
    ORDER BY opened_at DESC
    LIMIT 1;

    -- Fallback: nenhuma sessão própria aberta — usa a mais recente da
    -- empresa (comportamento anterior, preservado como rede de segurança).
    IF v_session.id IS NULL THEN
      SELECT * INTO v_session
      FROM public.cash_sessions
      WHERE company_id = v_tx.company_id AND status = 'open'
      ORDER BY opened_at DESC
      LIMIT 1;
    END IF;

    IF v_session.id IS NULL THEN
      RAISE EXCEPTION 'CAIXA_FECHADO: não é possível receber em Caixa sem uma sessão de caixa aberta. Abra o caixa antes de registrar a baixa.';
    END IF;

    INSERT INTO public.cash_movements (session_id, company_id, type, amount, reason, note, created_by, transaction_id)
    VALUES (
      v_session.id,
      v_tx.company_id,
      CASE WHEN v_tx.type = 'income' THEN 'cash_in' ELSE 'cash_out' END,
      v_amount,
      'Baixa financeira',
      COALESCE(v_notes, v_tx.description),
      auth.uid(),
      _transaction_id
    );
  END IF;

  UPDATE public.financial_accounts
  SET current_balance = COALESCE(current_balance, 0)
      + CASE WHEN v_tx.type = 'income' THEN v_amount ELSE -v_amount END,
      updated_at = now()
  WHERE id = _account_id;

  UPDATE public.financial_transactions
  SET status = 'paid',
      paid_at = v_paid_at,
      amount = v_amount,
      discount_amount = v_discount,
      payment_method = _payment_method,
      account_id = _account_id,
      notes = COALESCE(v_notes, notes),
      settlement_session_id = v_session.id,
      updated_at = now()
  WHERE id = _transaction_id
  RETURNING * INTO v_tx;

  -- FIN-SYNC — Sincroniza sales.status quando o recebível é da venda.
  IF v_tx.source = 'sale' AND v_tx.reference_id IS NOT NULL THEN
    SELECT * INTO v_sale FROM public.sales WHERE id = v_tx.reference_id;
    IF v_sale.id IS NOT NULL
       AND v_sale.status IN ('pending', 'partially_paid')
       AND NOT EXISTS (SELECT 1 FROM public.credit_accounts WHERE sale_id = v_sale.id)
    THEN
      UPDATE public.sales
      SET status = 'paid',
          paid_at = v_paid_at
      WHERE id = v_sale.id;
    END IF;
  END IF;

  -- FIN-SYNC 2 (2026-08-26) — Sincroniza o Crediário quando o
  -- lançamento liquidado aqui é o de "saldo do crediário" (criado em
  -- `create_credit_sale` só pra dar visibilidade em "A Receber").
  -- Sem isso, receber DIRETO pelo Financeiro (em vez de pela tela de
  -- Crediário) marcaria esse lançamento como pago, mas o Crediário
  -- continuaria mostrando a parcela como pendente pra sempre —
  -- exatamente o problema inverso do que já corrigimos.
  IF v_tx.source = 'credit_payment' AND v_tx.reference_id IS NOT NULL THEN
    SELECT * INTO v_installment FROM public.credit_installments WHERE id = v_tx.reference_id FOR UPDATE;
    IF v_installment.id IS NOT NULL THEN
      UPDATE public.credit_installments
         SET paid_amount = amount,
             status = 'paid',
             paid_at = v_paid_at,
             updated_at = now()
       WHERE id = v_installment.id;

      SELECT * INTO v_credit_account FROM public.credit_accounts WHERE id = v_installment.credit_account_id FOR UPDATE;
      IF v_credit_account.id IS NOT NULL THEN
        v_new_balance := GREATEST(v_credit_account.balance - v_amount, 0);
        UPDATE public.credit_accounts
           SET balance = v_new_balance,
               status = CASE WHEN v_new_balance = 0 THEN 'settled' ELSE 'partially_paid' END,
               settled_at = CASE WHEN v_new_balance = 0 THEN v_paid_at ELSE NULL END,
               updated_at = now()
         WHERE id = v_credit_account.id;

        UPDATE public.sales
           SET status = CASE WHEN v_new_balance = 0 THEN 'paid' ELSE 'partially_paid' END,
               paid_at = CASE WHEN v_new_balance = 0 THEN v_paid_at ELSE paid_at END,
               updated_at = now()
         WHERE id = v_credit_account.sale_id;
      END IF;
    END IF;
  END IF;

  RETURN v_tx;
END;
$function$;
