CREATE OR REPLACE FUNCTION public.preview_duplicate_products(_company_id uuid)
RETURNS TABLE(name_key text, keeper_id uuid, keeper_name text, keeper_sku text, keeper_stock numeric, duplicates jsonb, merged_stock numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Executa sem restrição quando não há usuário autenticado (Editor SQL / service_role).
  IF auth.uid() IS NOT NULL AND NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Acesso negado à empresa informada.';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT p.id,
           p.name,
           p.sku,
           p.price,
           p.stock,
           p.created_at,
           p.cover_image_path,
           public.product_name_key(p.name) AS nkey,
           EXISTS (SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id) AS has_image
    FROM public.products p
    WHERE p.company_id = _company_id
      AND coalesce(p.stock, 0) > 0
      AND p.sku NOT LIKE '%-MERGED'
      AND p.sku NOT LIKE '%_MERGED'
  ),
  grouped AS (
    SELECT b.*,
           count(*) OVER (PARTITION BY b.nkey) AS grp_size,
           row_number() OVER (
             PARTITION BY b.nkey
             ORDER BY
               ((b.cover_image_path IS NOT NULL OR b.has_image))::int DESC,
               (coalesce(b.price, 0) > 0)::int DESC,
               b.created_at ASC,
               b.id ASC
           ) AS rn
    FROM base b
    WHERE b.nkey IS NOT NULL
  )
  SELECT g.nkey,
         k.id,
         k.name,
         k.sku,
         k.stock,
         jsonb_agg(
           jsonb_build_object(
             'id', g.id, 'name', g.name, 'sku', g.sku,
             'price', g.price, 'stock', g.stock,
             'has_image', (g.cover_image_path IS NOT NULL OR g.has_image),
             'created_at', g.created_at
           ) ORDER BY g.created_at
         ) FILTER (WHERE g.rn > 1) AS duplicates,
         k.stock + coalesce(sum(g.stock) FILTER (WHERE g.rn > 1), 0) AS merged_stock
  FROM grouped g
  JOIN grouped k ON k.nkey = g.nkey AND k.rn = 1
  WHERE g.grp_size > 1
  GROUP BY g.nkey, k.id, k.name, k.sku, k.stock;
END;
$function$;