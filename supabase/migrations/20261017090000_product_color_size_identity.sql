-- =====================================================================
-- Produtos: Cor e Tamanho + identidade para o aviso de duplicado.
--
-- Antes, "duplicado" era decidido só pelo nome normalizado: duas
-- "Camiseta Nike Azul" de estampa ou tamanho diferente viravam o mesmo
-- produto (inclusive para a mesclagem automática de duplicados).
-- Agora a identidade é nome + modelo + cor + tamanho.
-- Nada muda em produtos já cadastrados: cor/tamanho começam vazios.
-- =====================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS size text;

COMMENT ON COLUMN public.products.color IS 'Cor da peça (ex.: Azul). Faz parte da identidade do produto.';
COMMENT ON COLUMN public.products.size IS 'Tamanho da peça (ex.: M, 38, Único). Faz parte da identidade do produto.';

-- Atributo normalizado; valores-padrão antigos ("Genérico", "Padrão") contam como vazio.
CREATE OR REPLACE FUNCTION public.product_attr_key(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN k IN ('generico', 'generica', 'padrao', 'n a', 'na') THEN ''
    ELSE k
  END
  FROM (
    SELECT btrim(regexp_replace(
      lower(public._sku_strip_accents(coalesce(_value, ''))),
      '[^a-z0-9/]+', ' ', 'g'
    )) AS k
  ) s;
$$;

-- Identidade: nome | modelo | cor | tamanho.
CREATE OR REPLACE FUNCTION public.product_identity_key(
  _name text, _model text, _color text, _size text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.product_name_key(_name) IS NULL THEN NULL
    ELSE public.product_name_key(_name)
      || '|' || public.product_attr_key(_model)
      || '|' || public.product_attr_key(_color)
      || '|' || public.product_attr_key(_size)
  END;
$$;

GRANT EXECUTE ON FUNCTION public.product_attr_key(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_identity_key(text, text, text, text) TO authenticated, service_role;

-- Pré-visualização/mesclagem de duplicados agrupa pela identidade completa
-- (merge_duplicate_products usa esta função, então herda a regra).
CREATE OR REPLACE FUNCTION public.preview_duplicate_products(_company_id uuid)
RETURNS TABLE(name_key text, keeper_id uuid, keeper_name text, keeper_sku text, keeper_stock numeric, duplicates jsonb, merged_stock numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
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
           public.product_identity_key(p.name, p.model, p.color, p.size) AS nkey,
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
