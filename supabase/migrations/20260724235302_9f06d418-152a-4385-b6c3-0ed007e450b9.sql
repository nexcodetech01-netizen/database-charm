CREATE OR REPLACE FUNCTION public.products_inventory_metrics(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_cutoff timestamptz := now() - interval '90 days';
  v_start_of_day timestamptz := date_trunc('day', now());
  v_total_products integer;
  v_active_products integer;
  v_below_min_count integer;
  v_total_stock_items numeric;
  v_inventory_value numeric;
  v_today_movements integer;
  v_below_min jsonb;
  v_stagnant jsonb;
  v_newest jsonb;
BEGIN
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'company_id é obrigatório';
  END IF;

  -- Autorização: o solicitante precisa ter acesso à empresa.
  IF NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Sem permissão para consultar métricas desta empresa' USING ERRCODE = '42501';
  END IF;

  -- Uma única varredura consolidada de products.
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE status = 'active')::int,
    count(*) FILTER (WHERE stock <= min_stock)::int,
    COALESCE(sum(stock), 0),
    COALESCE(sum(stock * cost), 0)
  INTO
    v_total_products,
    v_active_products,
    v_below_min_count,
    v_total_stock_items,
    v_inventory_value
  FROM public.products
  WHERE company_id = _company_id;

  -- Amostra dos produtos abaixo do mínimo (limitado — payload leve).
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_below_min
  FROM (
    SELECT id, name, sku, stock, min_stock
    FROM public.products
    WHERE company_id = _company_id
      AND stock <= min_stock
    ORDER BY (min_stock - stock) DESC, name ASC
    LIMIT 100
  ) t;

  -- Movimentações de hoje (contagem).
  SELECT count(*)::int
  INTO v_today_movements
  FROM public.inventory_movements
  WHERE company_id = _company_id
    AND movement_date >= v_start_of_day;

  -- Produtos parados: sem movimento nos últimos 90d, com estoque > 0 e criados antes do cutoff.
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_stagnant
  FROM (
    SELECT p.id, p.name, p.sku, p.stock
    FROM public.products p
    WHERE p.company_id = _company_id
      AND p.stock > 0
      AND p.created_at <= v_cutoff
      AND NOT EXISTS (
        SELECT 1 FROM public.inventory_movements im
        WHERE im.company_id = _company_id
          AND im.product_id = p.id
          AND im.movement_date >= v_cutoff
      )
    ORDER BY p.created_at ASC
    LIMIT 100
  ) t;

  -- Novos produtos (últimos cadastrados).
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_newest
  FROM (
    SELECT id, name, sku, stock, created_at
    FROM public.products
    WHERE company_id = _company_id
    ORDER BY created_at DESC
    LIMIT 10
  ) t;

  v_result := jsonb_build_object(
    'total_products', v_total_products,
    'active_products', v_active_products,
    'below_min_count', v_below_min_count,
    'total_stock_items', v_total_stock_items,
    'inventory_value', v_inventory_value,
    'today_movements', v_today_movements,
    'below_min_products', v_below_min,
    'stagnant_products', v_stagnant,
    'newest_products', v_newest
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.products_inventory_metrics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.products_inventory_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.products_inventory_metrics(uuid) TO service_role;