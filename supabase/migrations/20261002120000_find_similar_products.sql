-- =====================================================================
-- Sugestão de produto parecido na importação de compras.
--
-- O vínculo automático só reconhecia nome IGUAL (product_name_key). O
-- fornecedor quase nunca escreve igual ao cadastro ("Perfume Fem Atheeri
-- PREMIUM 50ml" × "Perfume Atheeri 50ml"), e a compra criava produto
-- duplicado no recebimento.
--
-- product_core_name: nome sem acento/pontuação e sem palavras genéricas
-- (perfume, masc, fem, premium, tamanhos como 50ml…) — sobra o "miolo"
-- ("atheeri", "prada paradoxe"). find_similar_products compara o miolo
-- por trigramas (pg_trgm) e devolve os mais parecidos da empresa.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.product_core_name(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT NULLIF(
    btrim(regexp_replace(
      regexp_replace(
        regexp_replace(
          coalesce(public.product_name_key(_name), ''),
          '\m\d+ ?(ml|g|gr|kg|l|un|cm)\M', ' ', 'g'),
        '\m(perfume|perfumes|masc|masculino|fem|feminino|unissex|premium|importado|original|edp|edt|parfum|eau|de|do|da|dos|das|e|kit|com)\M', ' ', 'g'),
      '\s+', ' ', 'g')),
    '');
$$;

CREATE OR REPLACE FUNCTION public.find_similar_products(
  company_id_param uuid,
  name_param text,
  limit_param int DEFAULT 3
)
RETURNS TABLE(
  id uuid,
  name text,
  sku text,
  cost numeric,
  stock numeric,
  unit text,
  score real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_core text := public.product_core_name(name_param);
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_has_company_access(company_id_param) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa' USING ERRCODE = '42501';
  END IF;
  IF v_core IS NULL OR length(v_core) < 3 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.name::text, p.sku::text, p.cost::numeric, p.stock::numeric, p.unit::text,
         public.similarity(public.product_core_name(p.name), v_core) AS score
    FROM public.products p
   WHERE p.company_id = company_id_param
     AND p.status = 'active'
     AND public.similarity(public.product_core_name(p.name), v_core) >= 0.4
   ORDER BY score DESC, p.name
   LIMIT GREATEST(LEAST(limit_param, 10), 1);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.find_similar_products(uuid, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_similar_products(uuid, text, int) TO authenticated;
