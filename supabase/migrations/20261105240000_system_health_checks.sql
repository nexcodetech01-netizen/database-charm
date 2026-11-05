-- =====================================================================
-- Saúde do sistema (05/11/2026): conferência diária dos números.
--
-- Uma função só, somente leitura, que aponta o que não bate:
--   critical · estoque negativo; venda sem baixa de estoque; compra
--              recebida sem entrada no estoque
--   warning  · saldo de conta ≠ lançamentos + transferências; vale-troca
--              vindo de venda cancelada; produto cadastrado em duplicidade;
--              financeiro de venda desencontrado (finance_consistency_issues);
--              falhas de integração (Mercado Livre etc.) nos últimos 7 dias
--   info     · estoque ≠ movimentações (resumo); rascunhos esquecidos
-- =====================================================================

CREATE OR REPLACE FUNCTION public.system_health_checks(_company_id uuid)
RETURNS TABLE(code text, severity text, title text, detail text,
              ref_type text, ref_id uuid, ref_label text)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa' USING ERRCODE = '42501';
  END IF;

  -- Estoque negativo
  RETURN QUERY
  SELECT 'stock_negative', 'critical', 'Estoque negativo',
         format('%s está com estoque %s.', p.name, trim_scale(p.stock::numeric)),
         'product', p.id, p.sku
    FROM public.products p
   WHERE p.company_id = _company_id AND p.status = 'active' AND COALESCE(p.stock, 0) < 0;

  -- Venda (paga ou no crediário) que não baixou o estoque
  RETURN QUERY
  SELECT 'sale_without_stock', 'critical', 'Venda não baixou o estoque',
         format('Venda %s (%s) está como %s, mas as peças não saíram do estoque.',
                s.number, to_char(s.created_at, 'DD/MM'),
                CASE s.status WHEN 'paid' THEN 'paga' WHEN 'pending' THEN 'no crediário'
                              ELSE 'parcialmente paga' END),
         'sale', s.id, s.number
    FROM public.sales s
   WHERE s.company_id = _company_id
     AND s.status IN ('paid', 'pending', 'partially_paid')
     AND NOT COALESCE(s.stock_applied, false)
     AND NOT COALESCE(s.stock_reversed, false)
     AND s.deleted_at IS NULL
     AND s.created_at >= now() - interval '60 days'
     AND EXISTS (SELECT 1 FROM public.sale_items si
                  WHERE si.sale_id = s.id AND si.product_id IS NOT NULL);

  -- Compra recebida sem entrada no estoque
  RETURN QUERY
  SELECT 'purchase_without_stock', 'critical', 'Compra recebida sem entrada no estoque',
         format('Compra %s está como recebida, mas as peças não entraram no estoque.', pu.number),
         'purchase', pu.id, pu.number
    FROM public.purchases pu
   WHERE pu.company_id = _company_id AND pu.status = 'received'
     AND NOT COALESCE(pu.stock_applied, false);

  -- Saldo da conta diferente dos lançamentos + transferências
  RETURN QUERY
  WITH mov AS (
    SELECT t.account_id AS acc,
           CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END AS v
      FROM public.financial_transactions t
     WHERE t.company_id = _company_id AND t.status = 'paid' AND t.account_id IS NOT NULL
    UNION ALL
    SELECT t.transfer_to_account_id, t.amount
      FROM public.financial_transactions t
     WHERE t.company_id = _company_id AND t.status = 'paid'
       AND t.type = 'transfer' AND t.transfer_to_account_id IS NOT NULL
    UNION ALL
    SELECT tr.from_account_id, -tr.amount FROM public.financial_transfers tr
     WHERE tr.company_id = _company_id
    UNION ALL
    SELECT tr.to_account_id, tr.amount FROM public.financial_transfers tr
     WHERE tr.company_id = _company_id
  ), calc AS (
    SELECT a.id, a.name, COALESCE(a.current_balance, 0) AS saved,
           COALESCE(a.initial_balance, 0) + COALESCE(SUM(m.v), 0) AS computed
      FROM public.financial_accounts a
      LEFT JOIN mov m ON m.acc = a.id
     WHERE a.company_id = _company_id AND a.status = 'active'
     GROUP BY a.id, a.name, a.current_balance, a.initial_balance
  )
  SELECT 'account_balance', 'warning', 'Saldo da conta não bate com os lançamentos',
         format('%s: saldo mostrado R$ %s, lançamentos somam R$ %s (diferença R$ %s).',
                c.name, replace(to_char(c.saved, 'FM999999990.00'), '.', ','),
                replace(to_char(c.computed, 'FM999999990.00'), '.', ','),
                replace(to_char(c.saved - c.computed, 'FM999999990.00'), '.', ',')),
         'account', c.id, c.name
    FROM calc c
   WHERE abs(c.saved - c.computed) > 0.009;

  -- Vale-troca em aberto vindo de venda que depois foi cancelada
  RETURN QUERY
  WITH bal AS (
    SELECT e.customer_id, SUM(e.amount) AS balance
      FROM public.customer_store_credit_entries e
     WHERE e.company_id = _company_id
     GROUP BY e.customer_id
    HAVING SUM(e.amount) > 0.009
  )
  SELECT 'store_credit_cancelled_sale', 'warning', 'Vale-troca de venda cancelada',
         format('%s tem R$ %s de vale-troca, mas a venda da troca (%s) foi cancelada depois.',
                c.name, replace(to_char(b.balance, 'FM999999990.00'), '.', ','),
                (SELECT string_agg(DISTINCT s.number, ', ')
                   FROM public.customer_store_credit_entries e
                   JOIN public.sales s ON s.id = e.sale_id
                  WHERE e.customer_id = b.customer_id AND e.kind = 'exchange'
                    AND s.status = 'cancelled')),
         'customer', c.id, c.name
    FROM bal b
    JOIN public.customers c ON c.id = b.customer_id
   WHERE EXISTS (SELECT 1 FROM public.customer_store_credit_entries e
                   JOIN public.sales s ON s.id = e.sale_id
                  WHERE e.customer_id = b.customer_id AND e.kind = 'exchange'
                    AND s.status = 'cancelled');

  -- Produto cadastrado em duplicidade (mesmo nome, estampa, cor e tamanho)
  RETURN QUERY
  SELECT 'product_duplicate', 'warning', 'Produto cadastrado mais de uma vez',
         format('%s aparece %s vezes (SKUs: %s).', min(p.name), count(*),
                string_agg(COALESCE(p.sku, '—'), ', ' ORDER BY p.created_at)),
         'product', (array_agg(p.id ORDER BY p.created_at))[1], min(p.sku)
    FROM public.products p
   WHERE p.company_id = _company_id AND p.status = 'active'
   GROUP BY public.product_identity_key(p.name, p.model, p.color, p.size)
  HAVING count(*) > 1
   LIMIT 50;

  -- Financeiro de venda desencontrado (regras já existentes)
  RETURN QUERY
  SELECT 'finance', 'warning', f.problem,
         format('Venda %s%s: %s', f.sale_number,
                CASE WHEN f.customer IS NOT NULL THEN ' (' || f.customer || ')' ELSE '' END,
                COALESCE(f.detail, '')),
         'sale', f.sale_id, f.sale_number
    FROM public.finance_consistency_issues(_company_id) f;

  -- Falhas de integração nos últimos 7 dias
  RETURN QUERY
  SELECT 'integration', 'warning', 'Falha na integração: ' || d.source,
         format('%s falha(s) nos últimos 7 dias. Última: %s', count(*),
                left(COALESCE((array_agg(d.error_message ORDER BY d.created_at DESC))[1], '—'), 160)),
         'integration', NULL::uuid, d.source
    FROM public.integration_dead_letters d
   WHERE d.company_id = _company_id
     AND d.status IN ('pending', 'retrying', 'failed')
     AND d.created_at >= now() - interval '7 days'
   GROUP BY d.source;

  -- Estoque diferente das movimentações (resumo: costuma ser muita coisa)
  SELECT count(*) INTO v_n
    FROM public.inventory_ledger_audit(_company_id) a
    JOIN public.products p ON p.id = a.product_id
   WHERE a.inconsistent AND p.status = 'active'
     AND p.product_type::text IS DISTINCT FROM 'kit';
  IF v_n > 0 THEN
    RETURN QUERY SELECT 'stock_ledger', 'info', 'Estoque diferente das entradas e saídas',
      format('%s produto(s) com estoque que não fecha com o histórico de movimentações. Confira em Estoque › Reconciliação.', v_n),
      'page', NULL::uuid, '/estoque/reconciliacao';
  END IF;

  -- Rascunhos esquecidos
  SELECT count(*) INTO v_n FROM public.sales s
   WHERE s.company_id = _company_id AND s.status = 'draft'
     AND s.deleted_at IS NULL AND s.created_at < now() - interval '1 day';
  IF v_n > 0 THEN
    RETURN QUERY SELECT 'stale_drafts', 'info', 'Vendas em rascunho esquecidas',
      format('%s venda(s) em rascunho há mais de 1 dia. Abra Vendas e apague as que não vão ser concluídas.', v_n),
      'page', NULL::uuid, '/vendas';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.system_health_checks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.system_health_checks(uuid) TO authenticated, service_role;
