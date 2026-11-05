-- Vale-troca para outra pessoa (05/11/2026): presente comprado por duas
-- pessoas e trocado por quem ganhou. A troca aceita escolher quem fica com
-- o vale; sem escolha, continua indo para quem comprou.
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

  -- Quem vai usar o vale: a pessoa escolhida na troca (ex.: quem ganhou o
  -- presente); sem escolha, quem comprou.
  v_customer_id := COALESCE(v_customer_id, v_sale.customer_id);
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
