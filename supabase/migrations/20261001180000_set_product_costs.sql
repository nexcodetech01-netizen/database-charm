-- =====================================================================
-- Preencher custos em lote (Produtos → "Preencher custos").
--
-- Atualiza products.cost dos produtos informados e, se pedido, corrige as
-- vendas JÁ FEITAS desses produtos que ficaram com custo zero
-- (sale_items.unit_cost/total_cost). Sem isso, o custo das peças vendidas
-- no fechamento dos meses passados continuaria zero e o lucro, inflado.
-- O gatilho trg_sale_item_cost_snapshot recalcula total_cost a partir de
-- unit_cost. Não mexe no preço de venda.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.set_product_costs(
  _company_id uuid,
  _items jsonb,
  _backfill_sales boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_products integer := 0;
  v_sale_items integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_items) <> 'array' THEN
    RAISE EXCEPTION 'Lista de custos inválida.';
  END IF;

  WITH input AS (
    SELECT (i->>'product_id')::uuid AS product_id,
           round((i->>'cost')::numeric, 4) AS cost
      FROM jsonb_array_elements(_items) AS i
     WHERE (i->>'cost') IS NOT NULL AND (i->>'cost')::numeric > 0
  ), updated AS (
    UPDATE products p
       SET cost = input.cost, updated_at = now()
      FROM input
     WHERE p.id = input.product_id
       AND p.company_id = _company_id
    RETURNING p.id
  )
  SELECT count(*) INTO v_products FROM updated;

  IF _backfill_sales THEN
    WITH input AS (
      SELECT (i->>'product_id')::uuid AS product_id,
             round((i->>'cost')::numeric, 4) AS cost
        FROM jsonb_array_elements(_items) AS i
       WHERE (i->>'cost') IS NOT NULL AND (i->>'cost')::numeric > 0
    ), fixed AS (
      UPDATE sale_items si
         SET unit_cost = input.cost
        FROM input, sales s
       WHERE si.product_id = input.product_id
         AND s.id = si.sale_id
         AND s.company_id = _company_id
         AND COALESCE(si.unit_cost, 0) = 0
      RETURNING si.id
    )
    SELECT count(*) INTO v_sale_items FROM fixed;
  END IF;

  RETURN jsonb_build_object('products', v_products, 'sale_items', v_sale_items);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_product_costs(uuid, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_product_costs(uuid, jsonb, boolean) TO authenticated;
