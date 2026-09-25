CREATE OR REPLACE FUNCTION public.search_products_unaccent(
    search_term text,
    company_id_param uuid,
    limit_param int DEFAULT 50,
    include_inactive boolean DEFAULT false
)
RETURNS SETOF public.products
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    normalized_search text := lower(public.unaccent(trim(coalesce(search_term, ''))));
BEGIN
    RETURN QUERY
    WITH search_words AS (
        SELECT word
        FROM regexp_split_to_table(normalized_search, E'\\s+') AS word
        WHERE word <> ''
    )
    SELECT p.*
    FROM public.products AS p
    WHERE p.company_id = company_id_param
      AND (include_inactive OR p.status = 'active')
      AND (
        normalized_search = ''
        OR NOT EXISTS (
            SELECT 1
            FROM search_words AS sw
            WHERE NOT (
                lower(public.unaccent(coalesce(p.name, ''))) ILIKE '%' || sw.word || '%'
                OR lower(public.unaccent(coalesce(p.sku, ''))) ILIKE '%' || sw.word || '%'
                OR lower(public.unaccent(coalesce(p.brand, ''))) ILIKE '%' || sw.word || '%'
                OR (btrim(coalesce(p.barcode, '')) <> 'SEM GTIN'
                    AND lower(public.unaccent(coalesce(p.barcode, ''))) ILIKE '%' || sw.word || '%')
                OR lower(public.unaccent(coalesce(p.description, ''))) ILIKE '%' || sw.word || '%'
                OR public.word_similarity(sw.word, lower(public.unaccent(coalesce(p.name, '')))) >= 0.4
                OR public.word_similarity(sw.word, lower(public.unaccent(coalesce(p.sku, '')))) >= 0.4
                OR public.word_similarity(sw.word, lower(public.unaccent(coalesce(p.brand, '')))) >= 0.4
                OR (btrim(coalesce(p.barcode, '')) <> 'SEM GTIN'
                    AND public.word_similarity(sw.word, lower(public.unaccent(coalesce(p.barcode, '')))) >= 0.4)
                OR public.word_similarity(sw.word, lower(public.unaccent(coalesce(p.description, '')))) >= 0.4
            )
        )
      )
    ORDER BY
        CASE
            WHEN lower(public.unaccent(coalesce(p.name, ''))) LIKE normalized_search || '%'
              OR lower(public.unaccent(coalesce(p.sku, ''))) LIKE normalized_search || '%'
            THEN 0
            ELSE 1
        END,
        public.similarity(lower(public.unaccent(coalesce(p.name, ''))), normalized_search) DESC,
        lower(public.unaccent(coalesce(p.name, ''))) ASC
    LIMIT greatest(coalesce(limit_param, 50), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_products_unaccent(text, uuid, int, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_products_unaccent(text, uuid, int, boolean) TO service_role;