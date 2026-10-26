-- =====================================================================
-- Vale-troca (26/10/2026)
--
-- Troca de mercadoria: a peça volta ao estoque e a cliente ganha crédito
-- (vale-troca) no valor dela, sem sair dinheiro do caixa. O crédito é
-- usado depois como abatimento numa venda nova (PDV); se a peça nova for
-- mais cara, paga-se só a diferença; se for mais barata, sobra saldo.
--
--   * customer_store_credit_entries — extrato do vale (+ troca, − uso).
--   * sales.store_credit_used — quanto do desconto da venda é vale-troca.
--     Um gatilho mantém o extrato em dia (uso, cancelamento, edição).
--   * create_sale_return(skip_refund) — devolução sem devolver dinheiro.
--   * create_sale_exchange — troca: devolução + crédito, numa transação.
--   * pay_sale_with_store_credit — conclui venda 100% paga com vale.
-- =====================================================================

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS store_credit_used numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_store_credit_used_check;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_store_credit_used_check
  CHECK (store_credit_used >= 0 AND store_credit_used <= COALESCE(discount, 0) + 0.01);

CREATE TABLE IF NOT EXISTS public.customer_store_credit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount <> 0),
  kind text NOT NULL CHECK (kind IN ('exchange', 'sale_use', 'sale_cancel', 'adjustment')),
  -- Venda apagada (ex.: rascunho/suspensa): o uso do vale some junto e o
  -- saldo volta sozinho.
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  return_id uuid REFERENCES public.sale_returns(id) ON DELETE SET NULL,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_store_credit_entries_customer_idx
  ON public.customer_store_credit_entries (company_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_store_credit_entries_sale_idx
  ON public.customer_store_credit_entries (sale_id) WHERE sale_id IS NOT NULL;

ALTER TABLE public.customer_store_credit_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store_credit_select" ON public.customer_store_credit_entries;
CREATE POLICY "store_credit_select" ON public.customer_store_credit_entries
  FOR SELECT USING (public.user_has_company_access(company_id));
-- Sem INSERT/UPDATE/DELETE direto: só pelas funções abaixo.

-- Saldo do vale-troca de uma cliente.
CREATE OR REPLACE FUNCTION public.customer_store_credit_balance(_customer_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(sum(amount), 0)::numeric(12,2)
    FROM public.customer_store_credit_entries
   WHERE customer_id = _customer_id;
$$;
REVOKE ALL ON FUNCTION public.customer_store_credit_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_store_credit_balance(uuid) TO authenticated, service_role;

-- Mantém o extrato igual ao vale usado na venda (inclui cancelamento).
CREATE OR REPLACE FUNCTION public.sync_sale_store_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_desired numeric(12,2);
  v_current numeric(12,2);
  v_delta numeric(12,2);
  v_balance numeric(12,2);
BEGIN
  v_desired := CASE
    WHEN NEW.status = 'cancelled' OR NEW.deleted_at IS NOT NULL THEN 0
    ELSE COALESCE(NEW.store_credit_used, 0)
  END;

  SELECT -COALESCE(sum(amount), 0) INTO v_current
    FROM public.customer_store_credit_entries
   WHERE sale_id = NEW.id AND kind IN ('sale_use', 'sale_cancel');

  v_delta := v_desired - v_current;
  IF abs(v_delta) < 0.005 THEN
    RETURN NEW;
  END IF;

  IF v_delta > 0 THEN
    IF NEW.customer_id IS NULL THEN
      RAISE EXCEPTION 'Para usar vale-troca, escolha a cliente na venda.';
    END IF;
    -- Trava a cliente: dois caixas não gastam o mesmo saldo.
    PERFORM 1 FROM public.customers WHERE id = NEW.customer_id FOR UPDATE;
    SELECT COALESCE(sum(amount), 0) INTO v_balance
      FROM public.customer_store_credit_entries
     WHERE customer_id = NEW.customer_id;
    IF v_balance + 0.005 < v_delta THEN
      RAISE EXCEPTION 'Saldo de vale-troca insuficiente (disponível: R$ %).',
        to_char(v_balance, 'FM999999990.00');
    END IF;
    INSERT INTO public.customer_store_credit_entries (company_id, customer_id, amount, kind, sale_id, notes)
    VALUES (NEW.company_id, NEW.customer_id, -v_delta, 'sale_use', NEW.id,
            'Usado na venda ' || COALESCE(NEW.number, NEW.id::text));
  ELSE
    INSERT INTO public.customer_store_credit_entries (company_id, customer_id, amount, kind, sale_id, notes)
    SELECT NEW.company_id, e.customer_id, -v_delta, 'sale_cancel', NEW.id,
           'Devolvido ao saldo (venda ' || COALESCE(NEW.number, NEW.id::text) || ')'
      FROM public.customer_store_credit_entries e
     WHERE e.sale_id = NEW.id AND e.kind = 'sale_use'
     ORDER BY e.created_at
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sale_store_credit ON public.sales;
CREATE TRIGGER trg_sync_sale_store_credit
  AFTER INSERT OR UPDATE OF store_credit_used, status, deleted_at ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sync_sale_store_credit();

-- Devolução: aceita skip_refund (troca, sem devolver dinheiro).
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
  -- Troca (vale-troca): devolve ao estoque sem devolver dinheiro.
  v_skip_refund       BOOLEAN := COALESCE((_input->>'skip_refund')::boolean, false);

  v_sale              RECORD;
  v_existing_id       UUID;
  v_return_id         UUID;
  v_return_number     TEXT;
  v_total             NUMERIC := 0;
  v_missing_count     INTEGER := 0;
  v_exceeds_count     INTEGER := 0;
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

  SELECT
      COALESCE(SUM(
        LEAST(
          GREATEST(0, (elem->>'quantity')::numeric),
          GREATEST(0, si.quantity - COALESCE(prev.qty, 0))
        )
        * (si.total / NULLIF(si.quantity, 0))
      ), 0),
      COUNT(*) FILTER (WHERE si.id IS NULL),
      COUNT(*) FILTER (
        WHERE si.id IS NOT NULL
          AND (elem->>'quantity')::numeric > GREATEST(0, si.quantity - COALESCE(prev.qty, 0))
      )
    INTO v_total, v_missing_count, v_exceeds_count
    FROM jsonb_array_elements(v_items) AS elem
    LEFT JOIN public.sale_items si
           ON si.id = NULLIF(elem->>'sale_item_id','')::uuid
          AND si.sale_id = v_sale_id
    LEFT JOIN LATERAL (
      SELECT SUM(sri.quantity) AS qty
        FROM public.sale_return_items sri
        JOIN public.sale_returns sr ON sr.id = sri.return_id
       WHERE sri.sale_item_id = si.id
         AND sr.status <> 'failed'
    ) prev ON true
   WHERE (elem->>'quantity')::numeric > 0;

  IF v_missing_count > 0 THEN
    RAISE EXCEPTION 'Item de venda inválido para devolução.';
  END IF;

  IF v_exceeds_count > 0 THEN
    RAISE EXCEPTION 'Quantidade a devolver maior do que o disponível para devolução.';
  END IF;

  v_is_cash    := v_sale.payment_method = 'cash';
  v_is_digital := v_sale.payment_method IN ('pix','credit_card','debit_card','payment_link','card','bella_pay');
  v_refund_status := CASE WHEN v_is_digital AND NOT v_skip_refund THEN 'requested' ELSE 'not_required' END;

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
    si.id,
    si.product_id,
    elem->>'description',
    LEAST(GREATEST(0, (elem->>'quantity')::numeric), si.quantity) AS qty,
    (si.total / NULLIF(si.quantity, 0)) AS effective_unit_price,
    LEAST(GREATEST(0, (elem->>'quantity')::numeric), si.quantity)
      * (si.total / NULLIF(si.quantity, 0)) AS effective_total
  FROM jsonb_array_elements(v_items) AS elem
  JOIN public.sale_items si
    ON si.id = NULLIF(elem->>'sale_item_id','')::uuid
   AND si.sale_id = v_sale_id
  WHERE (elem->>'quantity')::numeric > 0;

  INSERT INTO public.inventory_movements(
    company_id, product_id, type, quantity,
    reason, notes, movement_date,
    source, reference_id, reference_number
  )
  SELECT
    v_company_id,
    si.product_id,
    'in',
    LEAST(GREATEST(0, (elem->>'quantity')::numeric), si.quantity),
    CASE WHEN v_skip_refund THEN 'Troca de mercadoria' ELSE 'Devolução de venda' END,
    'Devolução ' || v_return_number || ' — venda ' || COALESCE(v_sale.number, v_sale.id::text),
    now(),
    'sale_return',
    v_return_id,
    v_return_number
  FROM jsonb_array_elements(v_items) AS elem
  JOIN public.sale_items si
    ON si.id = NULLIF(elem->>'sale_item_id','')::uuid
   AND si.sale_id = v_sale_id
  WHERE (elem->>'quantity')::numeric > 0
    AND si.product_id IS NOT NULL;

  IF v_total > 0 AND NOT v_skip_refund THEN
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
    'total', v_total,
    'financial_transaction_id', v_finance_id,
    'settled', COALESCE(v_settle_now, false),
    'idempotent', false
  );
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.create_sale_return(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sale_return(jsonb) TO authenticated;

-- Troca: devolve as peças ao estoque e gera vale-troca para a cliente.
CREATE OR REPLACE FUNCTION public.create_sale_exchange(_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid := NULLIF(_input->>'sale_id', '')::uuid;
  v_customer_id uuid := NULLIF(_input->>'customer_id', '')::uuid;
  v_sale record;
  v_result jsonb;
  v_return_id uuid;
  v_total numeric(12,2);
  v_existing uuid;
BEGIN
  SELECT id, company_id, customer_id, status, number INTO v_sale
    FROM public.sales WHERE id = v_sale_id;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada.';
  END IF;
  IF NOT public.user_has_company_access(v_sale.company_id) THEN
    RAISE EXCEPTION 'Sem acesso à empresa desta venda.';
  END IF;
  IF v_sale.status <> 'paid' THEN
    RAISE EXCEPTION 'Só dá para trocar peças de vendas pagas.';
  END IF;

  v_customer_id := COALESCE(v_sale.customer_id, v_customer_id);
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Escolha a cliente: o vale-troca fica no nome dela.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_customer_id AND company_id = v_sale.company_id) THEN
    RAISE EXCEPTION 'Cliente inválida.';
  END IF;

  -- Roda como dono (SECURITY DEFINER) depois de checar o acesso acima:
  -- o extrato só é gravado por aqui e pelo gatilho da venda.
  v_result := public.create_sale_return(
    _input
      || jsonb_build_object(
           'company_id', v_sale.company_id,
           'skip_refund', true,
           'reason', COALESCE(NULLIF(trim(_input->>'reason'), ''), 'Troca')
         )
  );
  v_return_id := (v_result->>'return_id')::uuid;

  -- Reenvio do mesmo pedido: o crédito já foi dado.
  SELECT id INTO v_existing
    FROM public.customer_store_credit_entries
   WHERE return_id = v_return_id AND kind = 'exchange';
  IF v_existing IS NOT NULL THEN
    RETURN v_result || jsonb_build_object(
      'customer_id', v_customer_id,
      'balance', public.customer_store_credit_balance(v_customer_id));
  END IF;

  SELECT total_value INTO v_total FROM public.sale_returns WHERE id = v_return_id;
  IF COALESCE(v_total, 0) > 0 THEN
    INSERT INTO public.customer_store_credit_entries
      (company_id, customer_id, amount, kind, sale_id, return_id, notes)
    VALUES (v_sale.company_id, v_customer_id, v_total, 'exchange', v_sale.id, v_return_id,
            'Troca da venda ' || COALESCE(v_sale.number, v_sale.id::text));
  END IF;

  RETURN v_result || jsonb_build_object(
    'customer_id', v_customer_id,
    'credit', COALESCE(v_total, 0),
    'balance', public.customer_store_credit_balance(v_customer_id));
END;
$$;
REVOKE ALL ON FUNCTION public.create_sale_exchange(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sale_exchange(jsonb) TO authenticated, service_role;

-- Venda 100% paga com vale-troca (total zero): conclui sem passar pelo
-- Financeiro, porque não entrou dinheiro.
CREATE OR REPLACE FUNCTION public.enforce_sale_paid_requires_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status <> 'paid' OR OLD.status IS NOT DISTINCT FROM 'paid' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.credit_accounts WHERE sale_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.grand_total, 0) <= 0.009 AND COALESCE(NEW.store_credit_used, 0) > 0 THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.financial_transactions ft
     WHERE ft.source = 'sale' AND ft.reference_id = NEW.id
       AND ft.status = 'paid'
       AND ft.payment_method IS NOT NULL
       AND ft.account_id IS NOT NULL
       AND ft.paid_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'LIQUIDACAO_OBRIGATORIA: a venda só pode ser marcada como paga após o recebimento ser registrado no Financeiro.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pay_sale_with_store_credit(_sale_id uuid)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada.';
  END IF;
  IF NOT public.user_has_company_access(v_sale.company_id) THEN
    RAISE EXCEPTION 'Sem acesso à empresa desta venda.';
  END IF;
  IF v_sale.status = 'paid' THEN
    RETURN v_sale;
  END IF;
  IF COALESCE(v_sale.grand_total, 0) > 0.009 OR COALESCE(v_sale.store_credit_used, 0) <= 0 THEN
    RAISE EXCEPTION 'Esta venda ainda tem valor a pagar.';
  END IF;

  -- Título de R$ 0 aberto para esta venda não tem o que receber.
  UPDATE public.financial_transactions
     SET status = 'cancelled', updated_at = now()
   WHERE source = 'sale' AND reference_id = _sale_id
     AND status IN ('pending', 'overdue') AND COALESCE(amount, 0) <= 0.009;

  UPDATE public.sales
     SET status = 'paid', updated_at = now()
   WHERE id = _sale_id
  RETURNING * INTO v_sale;
  RETURN v_sale;
END;
$$;
REVOKE ALL ON FUNCTION public.pay_sale_with_store_credit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_sale_with_store_credit(uuid) TO authenticated, service_role;
