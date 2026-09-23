-- FEATURE — Sugestão de reposição por giro de venda (2026-09-23).
--
-- Contexto: o NexOS já tinha DOIS lugares (independentes) que avisam quando
-- um produto está abaixo do estoque mínimo cadastrado (ExecutiveRecommendations
-- e o card "abaixo_minimo" do painel Bella Estoque) — nenhum dos dois olha
-- pra quanto o produto realmente vende, então nenhum sugere QUANTO comprar.
-- Esta migration cria UMA função nova, só leitura, que calcula isso:
--
--   1) giro: soma quanto cada produto vendeu nos últimos 60 dias (vendas
--      pagas) — produto tipo 'kit' nunca vende "ele mesmo" no estoque, então
--      a venda de um kit é explodida nos componentes reais via
--      product_kit_components (mesma lógica já usada em
--      compute_prolabore_safe_amount / apply_sale_to_inventory);
--   2) velocidade média diária = vendido em 60 dias / 60;
--   3) meta de estoque = a MAIOR entre (velocidade × 30 dias de cobertura)
--      e o mínimo cadastrado manualmente pelo lojista (min_stock) — nunca
--      ignora o mínimo que a pessoa já configurou;
--   4) sugestão de compra = meta de estoque − estoque atual (nunca negativa).
--
-- Só entram produtos com sugestão > 0 (produto já bem abastecido não aparece).
-- Não grava nada, não cria pedido de compra — apenas calcula e devolve.
-- Espelha o padrão de validação de empresa já usado em
-- compute_prolabore_safe_amount/credit_resolve_account.
CREATE OR REPLACE FUNCTION public.compute_restock_suggestions(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lookback_days CONSTANT integer := 60;
  v_coverage_days CONSTANT integer := 30;
  v_items jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Empresa nao vinculada ao usuario.' USING ERRCODE = '42501';
  END IF;

  WITH sold AS (
    -- Vendas diretas de produtos simples.
    SELECT si.product_id AS product_id, si.quantity AS qty
      FROM public.sale_items si
      JOIN public.sales s ON s.id = si.sale_id
      JOIN public.products p ON p.id = si.product_id
     WHERE s.company_id = _company_id
       AND s.status = 'paid'
       AND s.paid_at IS NOT NULL
       AND s.paid_at >= (now() - make_interval(days => v_lookback_days))
       AND si.product_id IS NOT NULL
       AND p.product_type IS DISTINCT FROM 'kit'

    UNION ALL

    -- Vendas de kits explodidas nos componentes reais (o kit em si não tem
    -- estoque/giro próprio de reposição — quem precisa ser reposto é o
    -- componente).
    SELECT pkc.component_id AS product_id, si.quantity * pkc.quantity AS qty
      FROM public.sale_items si
      JOIN public.sales s ON s.id = si.sale_id
      JOIN public.products p ON p.id = si.product_id
      JOIN public.product_kit_components pkc ON pkc.parent_id = si.product_id
     WHERE s.company_id = _company_id
       AND s.status = 'paid'
       AND s.paid_at IS NOT NULL
       AND s.paid_at >= (now() - make_interval(days => v_lookback_days))
       AND si.product_id IS NOT NULL
       AND p.product_type = 'kit'
  ),
  velocity AS (
    SELECT product_id, SUM(qty) AS qty_sold
      FROM sold
     GROUP BY product_id
  ),
  candidates AS (
    SELECT
      p.id AS product_id,
      p.name,
      p.sku,
      p.stock,
      p.min_stock,
      COALESCE(v.qty_sold, 0) AS qty_sold_60d,
      ROUND(COALESCE(v.qty_sold, 0) / v_lookback_days::numeric, 3) AS avg_daily_velocity,
      GREATEST(
        0,
        CEIL(
          GREATEST(
            COALESCE(v.qty_sold, 0) / v_lookback_days::numeric * v_coverage_days,
            COALESCE(p.min_stock, 0)
          ) - p.stock
        )
      ) AS suggested_qty
    FROM public.products p
    LEFT JOIN velocity v ON v.product_id = p.id
   WHERE p.company_id = _company_id
     AND p.status = 'active'
     AND p.product_type IS DISTINCT FROM 'kit'
  )
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'product_id', product_id,
               'name', name,
               'sku', sku,
               'stock', stock,
               'min_stock', min_stock,
               'qty_sold_60d', qty_sold_60d,
               'avg_daily_velocity', avg_daily_velocity,
               'suggested_qty', suggested_qty
             )
             ORDER BY suggested_qty DESC
           ),
           '[]'::jsonb
         )
    INTO v_items
    FROM (
      SELECT * FROM candidates WHERE suggested_qty > 0 ORDER BY suggested_qty DESC LIMIT 100
    ) top;

  RETURN jsonb_build_object(
    'lookback_days', v_lookback_days,
    'coverage_days', v_coverage_days,
    'as_of', CURRENT_DATE,
    'items', v_items
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.compute_restock_suggestions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_restock_suggestions(uuid) TO authenticated, service_role;