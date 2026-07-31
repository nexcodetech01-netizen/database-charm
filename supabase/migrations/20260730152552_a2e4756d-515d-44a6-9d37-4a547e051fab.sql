ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cest text;
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS default_ncm text,
  ADD COLUMN IF NOT EXISTS default_cest text;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_cest_format_check;
ALTER TABLE public.products ADD CONSTRAINT products_cest_format_check
  CHECK (cest IS NULL OR cest ~ '^[0-9]{7}$');

ALTER TABLE public.product_categories DROP CONSTRAINT IF EXISTS product_categories_default_ncm_check;
ALTER TABLE public.product_categories ADD CONSTRAINT product_categories_default_ncm_check
  CHECK (default_ncm IS NULL OR default_ncm ~ '^[0-9]{8}$');

ALTER TABLE public.product_categories DROP CONSTRAINT IF EXISTS product_categories_default_cest_check;
ALTER TABLE public.product_categories ADD CONSTRAINT product_categories_default_cest_check
  CHECK (default_cest IS NULL OR default_cest ~ '^[0-9]{7}$');

CREATE INDEX IF NOT EXISTS idx_products_name_trgm_fiscal
  ON public.products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_company_ncm
  ON public.products (company_id, ncm) WHERE ncm IS NOT NULL;

-- Sugestão fiscal por histórico: agrupa NCM/CEST de produtos com nome similar.
CREATE OR REPLACE FUNCTION public.suggest_product_fiscal(
  _company_id uuid,
  _name text,
  _limit integer DEFAULT 3
)
RETURNS TABLE (
  ncm text,
  cest text,
  usage_count integer,
  similarity real,
  sample_name text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH matches AS (
    SELECT p.ncm,
           p.cest,
           p.name,
           similarity(p.name, _name) AS sim
    FROM public.products p
    WHERE p.company_id = _company_id
      AND p.ncm IS NOT NULL
      AND length(btrim(coalesce(_name, ''))) >= 3
      AND (
        similarity(p.name, _name) >= 0.25
        OR p.name ILIKE '%' || btrim(_name) || '%'
      )
  )
  SELECT m.ncm,
         (array_agg(m.cest ORDER BY m.sim DESC NULLS LAST))[1] AS cest,
         count(*)::int AS usage_count,
         max(m.sim)::real AS similarity,
         (array_agg(m.name ORDER BY m.sim DESC))[1] AS sample_name
  FROM matches m
  GROUP BY m.ncm
  ORDER BY max(m.sim) DESC, count(*) DESC
  LIMIT greatest(coalesce(_limit, 3), 1);
$$;

GRANT EXECUTE ON FUNCTION public.suggest_product_fiscal(uuid, text, integer) TO authenticated;