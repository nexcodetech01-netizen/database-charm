
-- =====================================================================
-- CREDIÁRIO — Fase A (backend)
-- =====================================================================

-- 1) SALES: novos status/payment_method
ALTER TABLE public.sales DROP CONSTRAINT sales_status_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_status_check
  CHECK (status = ANY (ARRAY['draft','pending','partially_paid','paid','cancelled']));

ALTER TABLE public.sales DROP CONSTRAINT sales_payment_method_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY[
    'pix','pix_manual','cash','card','credit_card','debit_card',
    'payment_link','bella_pay','a_receber','credit'
  ]));

-- =====================================================================
-- 2) TABELA: credit_accounts (1 por venda)
-- =====================================================================
CREATE TABLE public.credit_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id           UUID NOT NULL UNIQUE REFERENCES public.sales(id) ON DELETE CASCADE,
  customer_id       UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  original_amount   NUMERIC(14,2) NOT NULL CHECK (original_amount > 0),
  down_payment      NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (down_payment >= 0),
  balance           NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','partially_paid','settled','cancelled')),
  due_date          DATE,
  notes             TEXT,
  created_by        UUID,
  opened_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at        TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_accounts TO authenticated;
GRANT ALL ON public.credit_accounts TO service_role;
ALTER TABLE public.credit_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_accounts_company_access" ON public.credit_accounts
  FOR ALL TO authenticated
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

CREATE INDEX idx_credit_accounts_company_status  ON public.credit_accounts(company_id, status);
CREATE INDEX idx_credit_accounts_customer        ON public.credit_accounts(customer_id);
CREATE INDEX idx_credit_accounts_due             ON public.credit_accounts(company_id, due_date) WHERE status IN ('open','partially_paid');

CREATE TRIGGER trg_credit_accounts_updated_at
  BEFORE UPDATE ON public.credit_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 3) TABELA: credit_installments (parcelas — MVP: 1; futuro: N)
-- =====================================================================
CREATE TABLE public.credit_installments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_account_id   UUID NOT NULL REFERENCES public.credit_accounts(id) ON DELETE CASCADE,
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sequence            INTEGER NOT NULL DEFAULT 1 CHECK (sequence > 0),
  amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  paid_amount         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  due_date            DATE,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','partially_paid','paid','cancelled')),
  paid_at             TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (credit_account_id, sequence)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_installments TO authenticated;
GRANT ALL ON public.credit_installments TO service_role;
ALTER TABLE public.credit_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_installments_company_access" ON public.credit_installments
  FOR ALL TO authenticated
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

CREATE INDEX idx_credit_installments_account ON public.credit_installments(credit_account_id, sequence);
CREATE INDEX idx_credit_installments_due     ON public.credit_installments(company_id, due_date) WHERE status IN ('pending','partially_paid');

CREATE TRIGGER trg_credit_installments_updated_at
  BEFORE UPDATE ON public.credit_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 4) TABELA: credit_payments (histórico de recebimentos)
-- =====================================================================
CREATE TABLE public.credit_payments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_account_id         UUID NOT NULL REFERENCES public.credit_accounts(id) ON DELETE CASCADE,
  installment_id            UUID REFERENCES public.credit_installments(id) ON DELETE SET NULL,
  company_id                UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount                    NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_method            TEXT NOT NULL,
  paid_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes                     TEXT,
  financial_transaction_id  UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  kind                      TEXT NOT NULL DEFAULT 'installment'
                            CHECK (kind IN ('down_payment','installment')),
  client_request_id         UUID,
  created_by                UUID,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (credit_account_id, client_request_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_payments TO authenticated;
GRANT ALL ON public.credit_payments TO service_role;
ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_payments_company_access" ON public.credit_payments
  FOR ALL TO authenticated
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

CREATE INDEX idx_credit_payments_account ON public.credit_payments(credit_account_id, paid_at DESC);
CREATE INDEX idx_credit_payments_company_date ON public.credit_payments(company_id, paid_at DESC);

CREATE TRIGGER trg_credit_payments_updated_at
  BEFORE UPDATE ON public.credit_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 5) Ajuste em apply_sale_to_finance: pular se venda tem crediário
--    (financeiro já é gerado por credit_payments)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.apply_sale_to_finance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_ft_id UUID;
  has_credit BOOLEAN;
BEGIN
  IF NEW.status = 'paid'
     AND (OLD.status IS DISTINCT FROM 'paid') THEN

    -- Se a venda tem crediário, o financeiro já é conduzido por credit_payments.
    SELECT EXISTS (
      SELECT 1 FROM public.credit_accounts WHERE sale_id = NEW.id
    ) INTO has_credit;

    IF has_credit THEN
      RETURN NEW;
    END IF;

    SELECT id INTO new_ft_id
      FROM public.financial_transactions
     WHERE source = 'sale' AND reference_id = NEW.id
     LIMIT 1;

    IF new_ft_id IS NULL THEN
      INSERT INTO public.financial_transactions(
        company_id, type, description, amount,
        transaction_date, due_date, paid_at, status,
        source, reference_id, reference_number, created_by
      ) VALUES (
        NEW.company_id, 'income',
        'Venda Nº ' || COALESCE(NEW.number, NEW.id::text),
        COALESCE(NEW.grand_total, 0),
        COALESCE(NEW.sale_date, CURRENT_DATE),
        COALESCE(NEW.sale_date, CURRENT_DATE),
        COALESCE(NEW.paid_at, now()),
        'paid',
        'sale', NEW.id, NEW.number,
        NEW.created_by
      )
      RETURNING id INTO new_ft_id;
    END IF;

    IF NEW.finance_ref IS DISTINCT FROM new_ft_id THEN
      UPDATE public.sales SET finance_ref = new_ft_id WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- =====================================================================
-- 6) Trigger: cancelar credit_account quando a venda é cancelada
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cancel_credit_account_on_sale_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.credit_accounts
       SET status = 'cancelled',
           cancelled_at = COALESCE(cancelled_at, now()),
           updated_at = now()
     WHERE sale_id = NEW.id
       AND status IN ('open','partially_paid');

    UPDATE public.credit_installments ci
       SET status = 'cancelled',
           updated_at = now()
      FROM public.credit_accounts ca
     WHERE ci.credit_account_id = ca.id
       AND ca.sale_id = NEW.id
       AND ci.status IN ('pending','partially_paid');

    INSERT INTO public.sale_events(sale_id, company_id, event_type, description, user_id)
    SELECT NEW.id, NEW.company_id, 'credit_cancelled',
           'Crediário cancelado junto com a venda',
           auth.uid()
     WHERE EXISTS (SELECT 1 FROM public.credit_accounts WHERE sale_id = NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_cancel_credit_on_sale_cancel
  AFTER UPDATE OF status ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.cancel_credit_account_on_sale_cancel();

-- =====================================================================
-- 7) RPC: create_credit_sale
--    Cria venda + credit_account + installment + baixa estoque
--    + (se down_payment > 0) credit_payment + FT
-- =====================================================================
CREATE OR REPLACE FUNCTION public.create_credit_sale(_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id        UUID   := (_input->>'company_id')::uuid;
  v_customer_id       UUID   := NULLIF(_input->>'customer_id','')::uuid;
  v_sale_id           UUID   := NULLIF(_input->>'sale_id','')::uuid;
  v_client_request_id UUID   := NULLIF(_input->>'client_request_id','')::uuid;
  v_down_payment      NUMERIC := COALESCE((_input->>'down_payment')::numeric, 0);
  v_down_method       TEXT   := NULLIF(_input->>'down_payment_method','');
  v_due_date          DATE   := NULLIF(_input->>'due_date','')::date;
  v_notes             TEXT   := NULLIF(_input->>'notes','');
  v_paid_at           TIMESTAMPTZ := COALESCE(NULLIF(_input->>'paid_at','')::timestamptz, now());

  v_sale              RECORD;
  v_account_id        UUID;
  v_installment_id    UUID;
  v_payment_id        UUID;
  v_ft_id             UUID;
  v_balance           NUMERIC;
  v_existing_account  UUID;
BEGIN
  IF v_company_id IS NULL OR v_sale_id IS NULL THEN
    RAISE EXCEPTION 'company_id e sale_id são obrigatórios';
  END IF;

  IF NOT public.user_has_company_access(v_company_id) THEN
    RAISE EXCEPTION 'Acesso negado à empresa.' USING ERRCODE = '42501';
  END IF;

  -- Idempotência
  SELECT id INTO v_existing_account
    FROM public.credit_accounts
   WHERE sale_id = v_sale_id
   LIMIT 1;

  IF v_existing_account IS NOT NULL THEN
    RETURN jsonb_build_object('credit_account_id', v_existing_account, 'idempotent', true);
  END IF;

  -- Trava e valida a venda
  SELECT * INTO v_sale FROM public.sales WHERE id = v_sale_id AND company_id = v_company_id FOR UPDATE;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada.';
  END IF;
  IF v_sale.customer_id IS NULL THEN
    RAISE EXCEPTION 'Crediário exige cliente vinculado à venda.';
  END IF;
  IF COALESCE(v_sale.grand_total, 0) <= 0 THEN
    RAISE EXCEPTION 'Valor total da venda inválido para crediário.';
  END IF;
  IF v_down_payment < 0 OR v_down_payment >= v_sale.grand_total THEN
    RAISE EXCEPTION 'Entrada inválida. Deve ser >= 0 e < total da venda (para crediário).';
  END IF;
  IF v_down_payment > 0 AND v_down_method IS NULL THEN
    RAISE EXCEPTION 'Forma de pagamento da entrada é obrigatória.';
  END IF;

  v_balance := v_sale.grand_total - v_down_payment;
  v_customer_id := COALESCE(v_customer_id, v_sale.customer_id);

  -- Cria conta de crediário
  INSERT INTO public.credit_accounts(
    company_id, sale_id, customer_id,
    original_amount, down_payment, balance,
    status, due_date, notes, created_by
  ) VALUES (
    v_company_id, v_sale_id, v_customer_id,
    v_sale.grand_total, v_down_payment, v_balance,
    CASE WHEN v_down_payment > 0 THEN 'partially_paid' ELSE 'open' END,
    v_due_date, v_notes, COALESCE(v_sale.created_by, auth.uid())
  )
  RETURNING id INTO v_account_id;

  -- Parcela única com o saldo (MVP)
  INSERT INTO public.credit_installments(
    credit_account_id, company_id, sequence, amount, due_date
  ) VALUES (
    v_account_id, v_company_id, 1, v_balance, v_due_date
  )
  RETURNING id INTO v_installment_id;

  -- Baixa de estoque (idempotente via stock_applied)
  IF COALESCE(v_sale.stock_applied, false) = false THEN
    INSERT INTO public.inventory_movements(
      company_id, product_id, type, quantity,
      reason, notes, movement_date, user_id,
      source, reference_id, reference_number
    )
    SELECT
      v_company_id, si.product_id, 'out', si.quantity,
      'Venda no crediário',
      'Venda ' || COALESCE(v_sale.number, v_sale.id::text) || ' (Crediário)',
      now(), v_sale.created_by,
      'sale', v_sale.id, v_sale.number
    FROM public.sale_items si
    WHERE si.sale_id = v_sale.id AND si.product_id IS NOT NULL;

    UPDATE public.sales SET stock_applied = true WHERE id = v_sale.id;
  END IF;

  -- Atualiza status/pagamento da venda
  UPDATE public.sales
     SET payment_method = 'credit',
         status = CASE WHEN v_down_payment > 0 THEN 'partially_paid' ELSE 'pending' END,
         updated_at = now()
   WHERE id = v_sale.id;

  -- Entrada (down payment) — cria FT e credit_payment
  IF v_down_payment > 0 THEN
    INSERT INTO public.financial_transactions(
      company_id, type, description, amount,
      transaction_date, due_date, paid_at, status,
      source, reference_id, reference_number, created_by
    ) VALUES (
      v_company_id, 'income',
      'Entrada crediário venda ' || COALESCE(v_sale.number, v_sale.id::text),
      v_down_payment,
      CURRENT_DATE, CURRENT_DATE, v_paid_at, 'paid',
      'sale', v_sale.id, v_sale.number,
      COALESCE(v_sale.created_by, auth.uid())
    )
    RETURNING id INTO v_ft_id;

    INSERT INTO public.credit_payments(
      credit_account_id, installment_id, company_id,
      amount, payment_method, paid_at, notes,
      financial_transaction_id, kind, client_request_id, created_by
    ) VALUES (
      v_account_id, NULL, v_company_id,
      v_down_payment, v_down_method, v_paid_at, 'Entrada no ato',
      v_ft_id, 'down_payment', v_client_request_id, COALESCE(v_sale.created_by, auth.uid())
    )
    RETURNING id INTO v_payment_id;
  END IF;

  -- Auditoria
  INSERT INTO public.sale_events(sale_id, company_id, event_type, description, metadata, user_id)
  VALUES (
    v_sale.id, v_company_id, 'credit_opened',
    'Crediário aberto',
    jsonb_build_object(
      'original_amount', v_sale.grand_total,
      'down_payment', v_down_payment,
      'balance', v_balance,
      'due_date', v_due_date
    ),
    COALESCE(v_sale.created_by, auth.uid())
  );

  RETURN jsonb_build_object(
    'credit_account_id', v_account_id,
    'installment_id', v_installment_id,
    'down_payment_id', v_payment_id,
    'financial_transaction_id', v_ft_id,
    'balance', v_balance,
    'idempotent', false
  );
END;
$function$;

-- =====================================================================
-- 8) RPC: receive_credit_payment
--    Registra recebimento, cria FT, aplica em parcelas (FIFO),
--    atualiza saldo, quita quando balance chega a zero.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.receive_credit_payment(_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_account_id        UUID    := (_input->>'credit_account_id')::uuid;
  v_amount            NUMERIC := (_input->>'amount')::numeric;
  v_method            TEXT    := _input->>'payment_method';
  v_paid_at           TIMESTAMPTZ := COALESCE(NULLIF(_input->>'paid_at','')::timestamptz, now());
  v_notes             TEXT    := NULLIF(_input->>'notes','');
  v_client_request_id UUID    := NULLIF(_input->>'client_request_id','')::uuid;

  v_account           RECORD;
  v_sale              RECORD;
  v_existing_payment  UUID;
  v_payment_id        UUID;
  v_ft_id             UUID;
  v_remaining         NUMERIC;
  v_ins               RECORD;
  v_apply             NUMERIC;
  v_new_balance       NUMERIC;
BEGIN
  IF v_account_id IS NULL OR v_amount IS NULL OR v_amount <= 0 OR v_method IS NULL THEN
    RAISE EXCEPTION 'credit_account_id, amount (>0) e payment_method são obrigatórios';
  END IF;

  -- Idempotência
  IF v_client_request_id IS NOT NULL THEN
    SELECT id INTO v_existing_payment
      FROM public.credit_payments
     WHERE credit_account_id = v_account_id
       AND client_request_id = v_client_request_id
     LIMIT 1;
    IF v_existing_payment IS NOT NULL THEN
      RETURN jsonb_build_object('payment_id', v_existing_payment, 'idempotent', true);
    END IF;
  END IF;

  SELECT * INTO v_account FROM public.credit_accounts WHERE id = v_account_id FOR UPDATE;
  IF v_account.id IS NULL THEN
    RAISE EXCEPTION 'Crediário não encontrado.';
  END IF;
  IF NOT public.user_has_company_access(v_account.company_id) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
  END IF;
  IF v_account.status NOT IN ('open','partially_paid') THEN
    RAISE EXCEPTION 'Crediário não está aberto (status=%).', v_account.status;
  END IF;
  IF v_amount > v_account.balance + 0.005 THEN
    RAISE EXCEPTION 'Valor recebido (%.2f) excede o saldo em aberto (%.2f).', v_amount, v_account.balance;
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = v_account.sale_id FOR UPDATE;

  -- FT do recebimento
  INSERT INTO public.financial_transactions(
    company_id, type, description, amount,
    transaction_date, due_date, paid_at, status,
    source, reference_id, reference_number, created_by
  ) VALUES (
    v_account.company_id, 'income',
    'Recebimento crediário venda ' || COALESCE(v_sale.number, v_sale.id::text),
    v_amount,
    v_paid_at::date, v_paid_at::date, v_paid_at, 'paid',
    'sale', v_sale.id, v_sale.number,
    COALESCE(auth.uid(), v_sale.created_by)
  )
  RETURNING id INTO v_ft_id;

  -- credit_payment
  INSERT INTO public.credit_payments(
    credit_account_id, installment_id, company_id,
    amount, payment_method, paid_at, notes,
    financial_transaction_id, kind, client_request_id, created_by
  ) VALUES (
    v_account_id, NULL, v_account.company_id,
    v_amount, v_method, v_paid_at, v_notes,
    v_ft_id, 'installment', v_client_request_id, COALESCE(auth.uid(), v_sale.created_by)
  )
  RETURNING id INTO v_payment_id;

  -- Aplica em parcelas (FIFO)
  v_remaining := v_amount;
  FOR v_ins IN
    SELECT * FROM public.credit_installments
     WHERE credit_account_id = v_account_id
       AND status IN ('pending','partially_paid')
     ORDER BY sequence
     FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_apply := LEAST(v_remaining, v_ins.amount - v_ins.paid_amount);
    IF v_apply <= 0 THEN CONTINUE; END IF;

    UPDATE public.credit_installments
       SET paid_amount = paid_amount + v_apply,
           status = CASE
             WHEN paid_amount + v_apply >= amount - 0.005 THEN 'paid'
             ELSE 'partially_paid'
           END,
           paid_at = CASE
             WHEN paid_amount + v_apply >= amount - 0.005 THEN v_paid_at
             ELSE paid_at
           END,
           updated_at = now()
     WHERE id = v_ins.id;

    v_remaining := v_remaining - v_apply;
  END LOOP;

  -- Atualiza saldo e status do account
  v_new_balance := GREATEST(0, v_account.balance - v_amount);
  UPDATE public.credit_accounts
     SET balance = v_new_balance,
         status = CASE WHEN v_new_balance <= 0.005 THEN 'settled' ELSE 'partially_paid' END,
         settled_at = CASE WHEN v_new_balance <= 0.005 THEN now() ELSE settled_at END,
         updated_at = now()
   WHERE id = v_account_id;

  -- Quitação → venda vira paga
  IF v_new_balance <= 0.005 THEN
    UPDATE public.sales
       SET status = 'paid',
           paid_at = COALESCE(paid_at, v_paid_at),
           updated_at = now()
     WHERE id = v_sale.id AND status <> 'paid';

    INSERT INTO public.sale_events(sale_id, company_id, event_type, description, user_id)
    VALUES (v_sale.id, v_account.company_id, 'credit_settled',
            'Crediário quitado', auth.uid());
  ELSE
    UPDATE public.sales
       SET status = 'partially_paid', updated_at = now()
     WHERE id = v_sale.id AND status NOT IN ('paid','cancelled');
  END IF;

  -- Auditoria do recebimento
  INSERT INTO public.sale_events(sale_id, company_id, event_type, description, metadata, user_id)
  VALUES (
    v_sale.id, v_account.company_id, 'credit_payment',
    'Recebimento de crediário',
    jsonb_build_object(
      'amount', v_amount,
      'payment_method', v_method,
      'balance_after', v_new_balance,
      'financial_transaction_id', v_ft_id
    ),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'financial_transaction_id', v_ft_id,
    'balance', v_new_balance,
    'settled', v_new_balance <= 0.005,
    'idempotent', false
  );
END;
$function$;

-- =====================================================================
-- 9) VIEW: sale_credit_summary — visão consolidada por venda
-- =====================================================================
CREATE OR REPLACE VIEW public.sale_credit_summary
WITH (security_invoker = true)
AS
SELECT
  ca.id                       AS credit_account_id,
  ca.company_id,
  ca.sale_id,
  ca.customer_id,
  ca.original_amount,
  ca.down_payment,
  ca.balance,
  ca.status,
  ca.due_date,
  ca.opened_at,
  ca.settled_at,
  ca.cancelled_at,
  (SELECT COALESCE(SUM(cp.amount), 0)
     FROM public.credit_payments cp
    WHERE cp.credit_account_id = ca.id
      AND cp.kind = 'installment') AS total_received_installments,
  (SELECT MAX(cp.paid_at)
     FROM public.credit_payments cp
    WHERE cp.credit_account_id = ca.id) AS last_payment_at,
  (SELECT MIN(ci.due_date)
     FROM public.credit_installments ci
    WHERE ci.credit_account_id = ca.id
      AND ci.status IN ('pending','partially_paid')) AS next_due_date
FROM public.credit_accounts ca;

GRANT SELECT ON public.sale_credit_summary TO authenticated, service_role;
