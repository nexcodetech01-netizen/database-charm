CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.search_products_unaccent(
    search_term text,
    company_id_param uuid,
    limit_param int DEFAULT 50
)
RETURNS SETOF public.products
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT p.*
    FROM public.products p
    WHERE p.company_id = company_id_param
      AND p.status = 'active'
      AND (
        unaccent(p.name) ILIKE unaccent('%' || search_term || '%') OR
        unaccent(p.sku) ILIKE unaccent('%' || search_term || '%') OR
        unaccent(p.brand) ILIKE unaccent('%' || search_term || '%') OR
        unaccent(p.description) ILIKE unaccent('%' || search_term || '%')
      )
    LIMIT limit_param;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_products_unaccent(text, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_products_unaccent(text, uuid, int) TO service_role;
