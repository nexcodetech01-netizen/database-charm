-- Saúde do sistema: venda paga só com vale-troca (total zero) não é
-- "paga sem recebimento" (casos reais VD-20261026-0004 e VD-20261029-0003).
CREATE OR REPLACE FUNCTION public.system_health_part_records(_company_id uuid)
RETURNS TABLE(code text, severity text, title text, detail text,
              ref_type text, ref_id uuid, ref_label text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $fn$
BEGIN
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
    FROM public.finance_consistency_issues(_company_id) f
    JOIN public.sales s ON s.id = f.sale_id
   -- Venda paga 100% com vale-troca (total zero) não tem recebimento.
   WHERE COALESCE(s.grand_total, 0) > 0.009;

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
END;
$fn$;
REVOKE ALL ON FUNCTION public.system_health_part_records(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.system_health_part_records(uuid) TO authenticated, service_role;
