-- 1) Garante o recebível PENDENTE da venda (idempotente, qualquer forma de pagamento)
CREATE OR REPLACE FUNCTION public.ensure_sale_receivable(_sale_id uuid)
RETURNS public.financial_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_tx public.financial_transactions;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.user_has_company_access(v_sale.company_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para operar esta venda.' USING ERRCODE = '42501';
  END IF;

  IF v_sale.status IN ('cancelled', 'draft') THEN
    RAISE EXCEPTION 'Venda em rascunho ou cancelada não gera recebível.' USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.credit_accounts WHERE sale_id = _sale_id) THEN
    RAISE EXCEPTION 'Venda com crediário é conduzida pelo módulo de Crediário.' USING ERRCODE = 'check_violation';
  END IF;

  -- Título em aberto já existente
  SELECT * INTO v_tx
    FROM public.financial_transactions
   WHERE source = 'sale' AND reference_id = _sale_id
     AND status NOT IN ('paid', 'cancelled', 'refunded')
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_tx.id IS NOT NULL THEN
    RETURN v_tx;
  END IF;

  -- Já baixado: devolve o título pago (o chamador decide o que fazer)
  SELECT * INTO v_tx
    FROM public.financial_transactions
   WHERE source = 'sale' AND reference_id = _sale_id AND status = 'paid'
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_tx.id IS NOT NULL THEN
    RETURN v_tx;
  END IF;

  INSERT INTO public.financial_transactions(
    company_id, type, description, amount,
    transaction_date, due_date, status,
    source, reference_id, reference_number, created_by
  ) VALUES (
    v_sale.company_id, 'income',
    'Venda Nº ' || COALESCE(v_sale.number, v_sale.id::text),
    COALESCE(v_sale.grand_total, 0),
    COALESCE(v_sale.sale_date, CURRENT_DATE),
    COALESCE(v_sale.due_date, v_sale.sale_date, CURRENT_DATE),
    'pending',
    'sale', v_sale.id, v_sale.number,
    COALESCE(v_sale.created_by, auth.uid())
  )
  RETURNING * INTO v_tx;

  UPDATE public.sales SET finance_ref = v_tx.id
   WHERE id = _sale_id AND finance_ref IS DISTINCT FROM v_tx.id;

  RETURN v_tx;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_sale_receivable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_sale_receivable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_sale_receivable(uuid) TO service_role;

-- 2) Trava: sales.status='paid' exige liquidação registrada pelo motor único
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

  -- Crediário: conduzido por credit_payments / create_credit_sale
  IF EXISTS (SELECT 1 FROM public.credit_accounts WHERE sale_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Exige liquidação real: título pago com forma e conta preenchidas
  IF NOT EXISTS (
    SELECT 1 FROM public.financial_transactions ft
     WHERE ft.source = 'sale' AND ft.reference_id = NEW.id
       AND ft.status = 'paid'
       AND ft.payment_method IS NOT NULL
       AND ft.account_id IS NOT NULL
       AND ft.paid_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'LIQUIDACAO_OBRIGATORIA: a venda só pode ser marcada como paga após o recebimento ser registrado (forma de pagamento e conta). Utilize a baixa financeira.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_sale_paid_requires_settlement ON public.sales;
CREATE TRIGGER trg_enforce_sale_paid_requires_settlement
BEFORE UPDATE OF status ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.enforce_sale_paid_requires_settlement();