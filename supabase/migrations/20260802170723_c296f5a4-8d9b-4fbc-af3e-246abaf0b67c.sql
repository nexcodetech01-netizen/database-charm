-- 1) Chave canônica de comparação de nomes de categoria
CREATE OR REPLACE FUNCTION public.category_name_key(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
           btrim(
             regexp_replace(
               lower(translate(coalesce(_name, ''),
                 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
                 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')),
               '[^a-z0-9]+', ' ', 'g')
           ),
           's$', '')
$$;

-- 2) Prévia: grupos de categorias equivalentes da empresa
CREATE OR REPLACE FUNCTION public.preview_duplicate_categories(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Acesso negado à empresa informada';
  END IF;

  WITH cats AS (
    SELECT c.id, c.name, c.status, c.min_margin_pct, c.target_margin_pct,
           c.max_margin_pct, c.auto_pricing_policy,
           public.category_name_key(c.name) AS key,
           (SELECT count(*) FROM products p WHERE p.category_id = c.id) AS product_count
    FROM product_categories c
    WHERE c.company_id = _company_id
  ),
  grouped AS (
    SELECT key,
           count(*) AS members,
           jsonb_agg(jsonb_build_object(
             'id', id, 'name', name, 'status', status,
             'product_count', product_count,
             'min_margin_pct', min_margin_pct,
             'target_margin_pct', target_margin_pct,
             'max_margin_pct', max_margin_pct,
             'auto_pricing_policy', auto_pricing_policy
           ) ORDER BY product_count DESC, length(name) DESC, name) AS categories,
           count(DISTINCT coalesce(min_margin_pct, -1)
                 || '/' || coalesce(target_margin_pct, -1)
                 || '/' || coalesce(max_margin_pct, -1)) > 1 AS policy_conflict
    FROM cats
    GROUP BY key
    HAVING count(*) > 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'key', key,
           'members', members,
           'policy_conflict', policy_conflict,
           'suggested_target_id', categories -> 0 ->> 'id',
           'suggested_target_name', categories -> 0 ->> 'name',
           'categories', categories
         ) ORDER BY key), '[]'::jsonb)
  INTO _result
  FROM grouped;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_duplicate_categories(uuid) TO authenticated;

-- 3) Unificação de categorias equivalentes
CREATE OR REPLACE FUNCTION public.merge_product_categories(
  _source_id uuid,
  _target_id uuid,
  _confirm_policy_conflict boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _src product_categories%ROWTYPE;
  _tgt product_categories%ROWTYPE;
  _moved_products int := 0;
  _moved_children int := 0;
  _moved_policies int := 0;
BEGIN
  IF _source_id = _target_id THEN
    RAISE EXCEPTION 'Categoria de origem e destino são iguais';
  END IF;

  SELECT * INTO _src FROM product_categories WHERE id = _source_id FOR UPDATE;
  SELECT * INTO _tgt FROM product_categories WHERE id = _target_id FOR UPDATE;

  IF _src.id IS NULL OR _tgt.id IS NULL THEN
    RAISE EXCEPTION 'Categoria não encontrada';
  END IF;
  IF _src.company_id <> _tgt.company_id THEN
    RAISE EXCEPTION 'Categorias de empresas diferentes não podem ser unificadas';
  END IF;
  IF NOT public.user_has_company_access(_src.company_id) THEN
    RAISE EXCEPTION 'Acesso negado à empresa informada';
  END IF;

  -- Conflito de política de margem exige confirmação explícita
  IF NOT _confirm_policy_conflict AND (
       coalesce(_src.min_margin_pct, -1)    <> coalesce(_tgt.min_margin_pct, -1)
    OR coalesce(_src.target_margin_pct, -1) <> coalesce(_tgt.target_margin_pct, -1)
    OR coalesce(_src.max_margin_pct, -1)    <> coalesce(_tgt.max_margin_pct, -1)
  ) THEN
    RAISE EXCEPTION 'Conflito de política de margem entre "%" e "%": confirme explicitamente antes de unificar', _src.name, _tgt.name;
  END IF;

  -- Produtos: apenas a referência técnica de categoria muda
  UPDATE products SET category_id = _target_id WHERE category_id = _source_id;
  GET DIAGNOSTICS _moved_products = ROW_COUNT;

  -- Subcategorias
  UPDATE product_categories SET parent_id = _target_id WHERE parent_id = _source_id;
  GET DIAGNOSTICS _moved_children = ROW_COUNT;

  -- Políticas versionadas: migram só se o destino ainda não possuir
  UPDATE category_pricing_policies cpp
     SET category_id = _target_id
   WHERE cpp.category_id = _source_id
     AND NOT EXISTS (
       SELECT 1 FROM category_pricing_policies t WHERE t.category_id = _target_id
     );
  GET DIAGNOSTICS _moved_policies = ROW_COUNT;

  DELETE FROM category_pricing_policies WHERE category_id = _source_id;
  DELETE FROM product_categories WHERE id = _source_id;

  RETURN jsonb_build_object(
    'merged_from', jsonb_build_object('id', _src.id, 'name', _src.name),
    'merged_into', jsonb_build_object('id', _tgt.id, 'name', _tgt.name),
    'products_moved', _moved_products,
    'children_moved', _moved_children,
    'policies_moved', _moved_policies
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_product_categories(uuid, uuid, boolean) TO authenticated;

-- 4) Proteção: impedir novas categorias equivalentes
CREATE OR REPLACE FUNCTION public.prevent_duplicate_category_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing text;
BEGIN
  SELECT c.name INTO _existing
  FROM product_categories c
  WHERE c.company_id = NEW.company_id
    AND c.id <> NEW.id
    AND public.category_name_key(c.name) = public.category_name_key(NEW.name)
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe a categoria "%" equivalente a "%". Utilize a categoria existente.', _existing, NEW.name
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_category_name ON public.product_categories;
CREATE TRIGGER trg_prevent_duplicate_category_name
BEFORE INSERT OR UPDATE OF name, company_id ON public.product_categories
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_category_name();