-- Busca de produtos mais esperta (26/10/2026).
-- Antes: só nome/SKU/marca/código/descrição; plural ("bolsas") e campos como
-- categoria e cor ficavam de fora, e erro de digitação comparava com a
-- descrição inteira (trazia ruído).
-- Agora:
--   * procura também em categoria, modelo, cor, tamanho e tags;
--   * ignora acento, caixa, pontuação e plural (bolsas -> bolsa,
--     transversais -> transversal, botões -> botão, colares -> colar);
--   * aceita erro de digitação comparando com nome/marca/categoria/cor;
--   * ordena por relevância: nome começando com o termo, todas as palavras
--     no nome, mais palavras achadas, parecido com o nome, com estoque.
-- Mesma assinatura e retorno: telas que já chamam continuam funcionando.

CREATE OR REPLACE FUNCTION public.search_term_singular(w text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN length(w) > 4 AND w ~ 'oes$' THEN regexp_replace(w, 'oes$', 'ao')
    WHEN length(w) > 4 AND w ~ 'aes$' THEN regexp_replace(w, 'aes$', 'ao')
    WHEN length(w) > 5 AND w ~ 'ais$' THEN regexp_replace(w, 'ais$', 'al')
    WHEN length(w) > 4 AND w ~ 'eis$' THEN regexp_replace(w, 'eis$', 'el')
    WHEN length(w) > 4 AND w ~ 'res$' THEN regexp_replace(w, 'es$', '')
    WHEN length(w) > 3 AND w ~ 'ns$' THEN regexp_replace(w, 'ns$', 'm')
    WHEN length(w) > 3 AND w ~ '[^s]s$' THEN left(w, -1)
    ELSE w
  END
$$;

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
    q text := btrim(regexp_replace(lower(public.unaccent(coalesce(search_term, ''))), '[^a-z0-9]+', ' ', 'g'));
    words text[];
BEGIN
    IF NOT public.user_has_company_access(company_id_param) THEN
        RAISE EXCEPTION 'Sem acesso à empresa.';
    END IF;

    SELECT coalesce(array_agg(public.search_term_singular(w)), '{}')
      INTO words
      FROM regexp_split_to_table(q, ' ') AS w
     WHERE w <> '';

    RETURN QUERY
    WITH base AS (
        SELECT
            p AS prod,
            p.stock AS stock,
            ' ' || btrim(regexp_replace(lower(public.unaccent(coalesce(p.name, ''))), '[^a-z0-9]+', ' ', 'g')) AS nname,
            ' ' || btrim(regexp_replace(lower(public.unaccent(concat_ws(' ',
                p.name, p.brand, p.model, p.color, p.size, c.name, p.tags::text))), '[^a-z0-9]+', ' ', 'g')) AS hay_main,
            ' ' || btrim(regexp_replace(lower(public.unaccent(concat_ws(' ',
                p.sku,
                CASE WHEN btrim(coalesce(p.barcode, '')) <> 'SEM GTIN' THEN p.barcode END,
                p.description))), '[^a-z0-9]+', ' ', 'g')) AS hay_extra
        FROM public.products AS p
        LEFT JOIN public.product_categories AS c ON c.id = p.category_id
        WHERE p.company_id = company_id_param
          AND (include_inactive OR p.status = 'active' OR p.status IS NULL)
    ),
    scored AS (
        SELECT
            b.*,
            (SELECT count(*) FROM unnest(words) AS w WHERE b.hay_main LIKE '%' || w || '%') AS main_hits,
            (SELECT count(*) FROM unnest(words) AS w WHERE b.nname LIKE '%' || w || '%') AS name_hits,
            (SELECT count(*) FROM unnest(words) AS w WHERE b.nname LIKE '% ' || w || '%') AS name_word_starts
        FROM base AS b
        WHERE cardinality(words) = 0
           OR NOT EXISTS (
                SELECT 1
                FROM unnest(words) AS w
                WHERE NOT (
                    b.hay_main LIKE '%' || w || '%'
                    OR b.hay_extra LIKE '%' || w || '%'
                    OR (length(w) >= 4 AND public.word_similarity(w, b.hay_main) >= 0.45)
                )
           )
    )
    SELECT (s.prod).*
    FROM scored AS s
    ORDER BY
        (s.nname LIKE ' ' || q || '%') DESC,
        (s.name_hits = cardinality(words)) DESC,
        s.main_hits DESC,
        s.name_word_starts DESC,
        public.similarity(s.nname, q) DESC,
        (s.stock > 0) DESC,
        s.nname ASC
    LIMIT greatest(coalesce(limit_param, 50), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.search_products_unaccent(text, uuid, int, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_products_unaccent(text, uuid, int, boolean) TO authenticated, service_role;
