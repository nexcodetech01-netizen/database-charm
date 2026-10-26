-- Venda paga com vale-troca: grava a data do pagamento (26/10/2026).

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
     SET status = 'paid', paid_at = COALESCE(paid_at, now()), updated_at = now()
   WHERE id = _sale_id
  RETURNING * INTO v_sale;
  RETURN v_sale;
END;
$$;

-- Vendas já pagas com vale sem data de pagamento.
UPDATE public.sales
   SET paid_at = updated_at
 WHERE status = 'paid' AND paid_at IS NULL
   AND COALESCE(store_credit_used, 0) > 0 AND COALESCE(grand_total, 0) <= 0.009;
