-- FEATURE — Teto seguro único de pró-labore (2026-09-21).
--
-- Contexto: existiam 3 cálculos diferentes de "quanto dá pra retirar" na
-- Bella Contadora (payroll.ts, advisor/engine.ts, financial-reports.service.ts),
-- nenhum descontando o custo pra repor o estoque vendido, e um deles
-- (FinancialReportsService.proLabore) ficava exagerado no início do mês
-- por comparar com despesas já pagas naquele mês (quase zero nos primeiros
-- dias). Esta migration cria UMA função só, somente leitura, que vira a
-- fonte única desse número em todo o sistema:
--
--   saldo em caixa (contas ativas)
--   MENOS contas a pagar pendentes com vencimento nos próximos 30 dias
--   MENOS custo estimado pra repor o estoque vendido nos últimos 30 dias
--     (custo, não preço de venda — produtos simples usam products.cost;
--      produtos tipo 'kit' nunca têm custo próprio, então usa o custo dos
--      componentes reais via product_kit_components, mesma lógica de
--      explosão de kit já usada em apply_sale_to_inventory())
--   = valor máximo seguro pra retirada
--
-- Não grava nada — apenas calcula e devolve. Espelha o padrão de
-- validação de empresa já usado em credit_resolve_account/generate_product_sku.

CREATE OR REPLACE FUNCTION public.compute_prolabore_safe_amount(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cash_balance      numeric := 0;
  v_payables_30d      numeric := 0;
  v_restock_cost_30d  numeric := 0;
  v_safe_amount       numeric := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Empresa nao vinculada ao usuario.' USING ERRCODE = '42501';
  END IF;

  -- Saldo em caixa: soma das contas financeiras ativas.
  SELECT COALESCE(SUM(fa.current_balance), 0)
    INTO v_cash_balance
    FROM public.financial_accounts fa
   WHERE fa.company_id = _company_id
     AND fa.status = 'active';

  -- Contas a pagar pendentes com vencimento nos próximos 30 dias.
  SELECT COALESCE(SUM(ft.amount), 0)
    INTO v_payables_30d
    FROM public.financial_transactions ft
   WHERE ft.company_id = _company_id
     AND ft.type = 'expense'
     AND ft.status = 'pending'
     AND ft.due_date IS NOT NULL
     AND ft.due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')::date;

  -- Custo de reposição do estoque vendido nos últimos 30 dias (vendas
  -- pagas). Produto simples: quantidade vendida × custo do próprio
  -- produto. Produto tipo 'kit': nunca tem custo próprio de estoque —
  -- soma o custo dos componentes reais (mesma explosão de
  -- apply_sale_to_inventory / product_kit_components).
  SELECT COALESCE(SUM(line_cost), 0)
    INTO v_restock_cost_30d
    FROM (
      SELECT si.quantity * COALESCE(p.cost, 0) AS line_cost
        FROM public.sale_items si
        JOIN public.sales s ON s.id = si.sale_id
        JOIN public.products p ON p.id = si.product_id
       WHERE s.company_id = _company_id
         AND s.status = 'paid'
         AND s.paid_at IS NOT NULL
         AND s.paid_at >= (now() - INTERVAL '30 days')
         AND si.product_id IS NOT NULL
         AND p.product_type IS DISTINCT FROM 'kit'

      UNION ALL

      SELECT si.quantity * pkc.quantity * COALESCE(pc.cost, 0) AS line_cost
        FROM public.sale_items si
        JOIN public.sales s ON s.id = si.sale_id
        JOIN public.products p ON p.id = si.product_id
        JOIN public.product_kit_components pkc ON pkc.parent_id = si.product_id
        JOIN public.products pc ON pc.id = pkc.component_id
       WHERE s.company_id = _company_id
         AND s.status = 'paid'
         AND s.paid_at IS NOT NULL
         AND s.paid_at >= (now() - INTERVAL '30 days')
         AND si.product_id IS NOT NULL
         AND p.product_type = 'kit'
    ) costs;

  v_safe_amount := GREATEST(0, v_cash_balance - v_payables_30d - v_restock_cost_30d);

  RETURN jsonb_build_object(
    'cash_balance', v_cash_balance,
    'payables_30d', v_payables_30d,
    'restock_cost_30d', v_restock_cost_30d,
    'safe_amount', v_safe_amount,
    'as_of', CURRENT_DATE
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.compute_prolabore_safe_amount(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_prolabore_safe_amount(uuid) TO authenticated, service_role;