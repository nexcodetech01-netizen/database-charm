-- =====================================================================
-- Bella: "quantos perfumes vendi esse mês?"
--
-- Produtos vendidos no período cujo NOME ou CATEGORIA contém o termo
-- (sem acento, singular/plural), com:
--   · unidades e valor vendidos no período (mesmas regras do fechamento:
--     vendas pagas, parciais e pendentes, fora da lixeira e sem homologação);
--   · estoque atual;
--   · sugestão de reposição pelo giro de 60 dias para cobrir 30 dias
--     (mesma fórmula de compute_restock_suggestions / tela de Estoque).
--
-- Acesso: usuário da empresa, ou service_role (runtime da Bella no servidor).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.products_sold_summary(
  _company_id uuid,
  _term text,
  _start date,
  _end date
)
RETURNS TABLE(
  product_id uuid,
  name text,
  category text,
  quantity numeric,
  revenue numeric,
  stock numeric,
  sold_60d numeric,
  suggested_qty numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
#variable_conflict use_column
DECLARE
  v_tz constant text := 'America/Sao_Paulo';
  v_term text := lower(unaccent(trim(coalesce(_term, ''))));
  v_singular text;
  v_start_ts timestamptz := _start::timestamp AT TIME ZONE v_tz;
  v_end_ts timestamptz := (_end + 1)::timestamp AT TIME ZONE v_tz;
BEGIN
  IF _company_id IS NULL THEN
    RAISE EXCEPTION '_company_id é obrigatório';
  END IF;
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT (auth.uid() IS NOT NULL AND public.user_has_company_access(_company_id)) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa' USING ERRCODE = '42501';
  END IF;
  IF length(v_term) < 2 THEN
    RAISE EXCEPTION 'Informe o produto ou a categoria (ex.: perfume).';
  END IF;

  -- "perfumes" → "perfume", "bolsas" → "bolsa"
  v_singular := regexp_replace(v_term, 'e?s$', '');
  IF length(v_singular) < 3 THEN
    v_singular := v_term;
  END IF;

  RETURN QUERY
  WITH matched AS (
    SELECT p.id, p.name::text AS name, pc.name::text AS category, p.stock, p.min_stock
      FROM products p
      LEFT JOIN product_categories pc ON pc.id = p.category_id
     WHERE p.company_id = _company_id
       AND (
         lower(unaccent(p.name)) LIKE '%' || v_singular || '%'
         OR lower(unaccent(coalesce(pc.name, ''))) LIKE '%' || v_singular || '%'
       )
  ),
  period AS (
    SELECT si.product_id, SUM(si.quantity) AS qty, SUM(si.total) AS rev
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
     WHERE s.company_id = _company_id
       AND s.status IN ('paid', 'partially_paid', 'pending')
       AND s.deleted_at IS NULL
       AND s.is_test = false
       AND s.created_at >= v_start_ts
       AND s.created_at < v_end_ts
       AND si.product_id IN (SELECT id FROM matched)
     GROUP BY si.product_id
  ),
  last60 AS (
    SELECT si.product_id, SUM(si.quantity) AS qty
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
     WHERE s.company_id = _company_id
       AND s.status = 'paid'
       AND s.paid_at >= now() - interval '60 days'
       AND si.product_id IN (SELECT id FROM matched)
     GROUP BY si.product_id
  )
  SELECT m.id,
         m.name,
         m.category,
         COALESCE(pe.qty, 0)::numeric,
         COALESCE(pe.rev, 0)::numeric,
         COALESCE(m.stock, 0)::numeric,
         COALESCE(l.qty, 0)::numeric,
         GREATEST(
           0,
           CEIL(GREATEST(COALESCE(l.qty, 0) / 60.0 * 30, COALESCE(m.min_stock, 0)) - COALESCE(m.stock, 0))
         )::numeric
    FROM matched m
    LEFT JOIN period pe ON pe.product_id = m.id
    LEFT JOIN last60 l ON l.product_id = m.id
   WHERE COALESCE(pe.qty, 0) > 0 OR COALESCE(l.qty, 0) > 0
   ORDER BY COALESCE(pe.qty, 0) DESC, COALESCE(pe.rev, 0) DESC, m.name;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.products_sold_summary(uuid, text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.products_sold_summary(uuid, text, date, date) TO authenticated, service_role;
