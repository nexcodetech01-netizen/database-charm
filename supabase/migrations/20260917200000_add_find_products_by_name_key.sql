-- Sugestão de produto existente ao lançar uma compra (linha manual ou
-- importação de nota/pedido).
--
-- Hoje, quando um item de compra não tem `product_id` (linha manual, ou
-- item extraído por IA/XML de NF-e na importação), `ensureProductsForItems`
-- (src/features/purchases/services/purchases.service.ts) cria um produto
-- novo direto, sem checar se já existe um com o mesmo nome — é assim que
-- produtos duplicados nascem (mesmo fornecedor, mesma peça, comprada de
-- novo, vira um produto novo no catálogo em vez de somar estoque no
-- existente). Já existia até uma ferramenta de limpeza retroativa pra isso
-- (`preview_duplicate_products` / `merge_duplicate_products`,
-- 20260801220144 em diante) — só que ela limpa DEPOIS do problema
-- acontecer, não evita que aconteça.
--
-- Esta função dá à interface um jeito de avisar ANTES: reaproveita a MESMA
-- normalização de nome já usada pela ferramenta de limpeza
-- (`product_name_key`, já existente), então um produto que a ferramenta de
-- limpeza consideraria duplicado é exatamente o mesmo que esta função
-- encontra como sugestão — sem duas lógicas de "o que conta como o mesmo
-- produto" divergindo entre si.
CREATE OR REPLACE FUNCTION public.find_products_by_name_key(
  company_id_param uuid,
  name_param text,
  limit_param int DEFAULT 5
)
RETURNS SETOF public.products
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.product_name_key(name_param) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.*
  FROM public.products p
  WHERE p.company_id = company_id_param
    AND p.status = 'active'
    AND public.product_name_key(p.name) = public.product_name_key(name_param)
  ORDER BY p.created_at ASC
  LIMIT limit_param;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_products_by_name_key(uuid, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_products_by_name_key(uuid, text, int) TO service_role;
