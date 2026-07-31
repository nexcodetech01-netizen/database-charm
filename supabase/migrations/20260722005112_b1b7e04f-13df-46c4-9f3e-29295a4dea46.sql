-- =========================================================
-- P0-1 · Cancelamento de venda paga: estorno completo
-- =========================================================

-- 1) cancel_sale como SECURITY DEFINER para garantir execução dos triggers
--    de estorno mesmo com RLS restritiva no usuário chamador.
CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_sale public.sales%ROWTYPE;
BEGIN
  -- Autorização explícita: apenas usuários com acesso à empresa da venda
  IF NOT EXISTS (
    SELECT 1 FROM public.sales s
     WHERE s.id = _sale_id
       AND public.user_has_company_access(s.company_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar esta venda.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO current_sale
    FROM public.sales
   WHERE id = _sale_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada.';
  END IF;

  IF current_sale.status = 'cancelled' THEN
    RETURN current_sale;
  END IF;

  IF current_sale.status NOT IN ('draft', 'pending', 'paid') THEN
    RAISE EXCEPTION 'A venda no status % não pode ser cancelada.', current_sale.status;
  END IF;

  UPDATE public.sales
     SET status = 'cancelled'
   WHERE id = _sale_id
   RETURNING * INTO current_sale;

  RETURN current_sale;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_sale(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid) TO authenticated, service_role;

-- 2) Estende o trigger de cancelamento financeiro para cobrir vendas pagas:
--    - Cria transação inversa (expense) marcando "Estorno de venda …"
--    - Atualiza a transação original para status 'refunded'
--    - Registra saída em cash_movements se a sessão de caixa estiver aberta
--    - Marca a cobrança Bella Pay associada como 'refunded' (o refund real
--      no Asaas será disparado pela camada de aplicação; aqui apenas
--      sinalizamos a intenção de estorno para o gateway)
CREATE OR REPLACE FUNCTION public.cancel_sale_finance_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_original_ft public.financial_transactions%ROWTYPE;
  v_session_status text;
  v_amount numeric;
BEGIN
  IF NEW.status <> 'cancelled' OR OLD.status IS NOT DISTINCT FROM 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- (a) Transações NÃO pagas ligadas à venda → cancelled (comportamento antigo)
  UPDATE public.financial_transactions
     SET status = 'cancelled', updated_at = now()
   WHERE source = 'sale'
     AND reference_id = NEW.id
     AND status NOT IN ('paid', 'cancelled', 'refunded');

  -- (b) Se a venda estava paga, precisa estorno: transação inversa +
  --     original marcada como refunded + saída de caixa + refund Bella Pay.
  IF OLD.status = 'paid' THEN
    -- Localiza a transação original paga
    SELECT * INTO v_original_ft
      FROM public.financial_transactions
     WHERE source = 'sale'
       AND reference_id = NEW.id
       AND status = 'paid'
     ORDER BY paid_at DESC NULLS LAST, created_at DESC
     LIMIT 1;

    v_amount := COALESCE(v_original_ft.amount, NEW.grand_total, 0);

    -- Idempotência: só cria estorno se ainda não existir
    IF NOT EXISTS (
      SELECT 1 FROM public.financial_transactions
       WHERE source = 'sale_cancellation'
         AND reference_id = NEW.id
    ) AND v_amount > 0 THEN
      INSERT INTO public.financial_transactions(
        company_id, type, description, amount,
        transaction_date, due_date, paid_at, status,
        source, reference_id, reference_number,
        account_id, category_id, created_by
      ) VALUES (
        NEW.company_id, 'expense',
        'Estorno de venda ' || COALESCE(NEW.number, NEW.id::text),
        v_amount,
        CURRENT_DATE, CURRENT_DATE, now(), 'paid',
        'sale_cancellation', NEW.id,
        'EST-' || COALESCE(NEW.number, NEW.id::text),
        v_original_ft.account_id, NULL, NEW.created_by
      );
    END IF;

    -- Marca a transação original como 'refunded' (auditoria)
    IF v_original_ft.id IS NOT NULL THEN
      UPDATE public.financial_transactions
         SET status = 'refunded', updated_at = now()
       WHERE id = v_original_ft.id;
    END IF;

    -- (c) Saída de caixa quando a sessão de origem existe e está aberta.
    --     Não abrimos caixa fechado; apenas registramos quando é seguro.
    IF NEW.cash_session_id IS NOT NULL THEN
      SELECT status INTO v_session_status
        FROM public.cash_sessions
       WHERE id = NEW.cash_session_id;

      IF v_session_status = 'open' AND v_amount > 0 THEN
        INSERT INTO public.cash_movements(
          session_id, company_id, type, amount, reason, note, created_by
        ) VALUES (
          NEW.cash_session_id, NEW.company_id, 'out', v_amount,
          'sale_cancellation',
          'Estorno por cancelamento da venda ' || COALESCE(NEW.number, NEW.id::text),
          NEW.created_by
        );
      END IF;
    END IF;

    -- (d) Bella Pay: marca cobrança como refunded para sinalizar ao gateway.
    --     O refund efetivo no Asaas é disparado pela camada de aplicação
    --     (server function) quando o usuário confirma o cancelamento na UI.
    IF NEW.bella_pay_ref IS NOT NULL THEN
      UPDATE public.bella_pay_charges
         SET status = 'refunded',
             canceled_at = COALESCE(canceled_at, now()),
             updated_at = now()
       WHERE sale_id = NEW.id
         AND status NOT IN ('refunded', 'canceled');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_sale_finance_on_cancel ON public.sales;
CREATE TRIGGER trg_cancel_sale_finance_on_cancel
AFTER UPDATE OF status ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.cancel_sale_finance_on_cancel();

-- 3) Garante índice único de idempotência para estorno financeiro por venda
CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_sale_cancellation_uniq
  ON public.financial_transactions(reference_id)
  WHERE source = 'sale_cancellation';
