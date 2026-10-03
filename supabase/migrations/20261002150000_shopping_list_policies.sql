-- =====================================================================
-- Lista de compras: políticas de acesso consertadas.
--
-- As políticas originais comparavam com profiles.company_id — coluna que
-- não existe mais (o perfil usa current_company_id). Resultado: excluir,
-- marcar como comprado e editar não afetavam nenhuma linha, sem erro, e a
-- lista parecia "não funcionar". Agora usam o padrão do sistema:
-- user_has_company_access(company_id) — funciona também para a sócia.
-- =====================================================================

ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopping_list_items_select" ON public.shopping_list_items;
DROP POLICY IF EXISTS "shopping_list_items_insert" ON public.shopping_list_items;
DROP POLICY IF EXISTS "shopping_list_items_update" ON public.shopping_list_items;
DROP POLICY IF EXISTS "shopping_list_items_delete" ON public.shopping_list_items;

CREATE POLICY "shopping_list_items_select" ON public.shopping_list_items
  FOR SELECT TO authenticated
  USING (public.user_has_company_access(company_id));

CREATE POLICY "shopping_list_items_insert" ON public.shopping_list_items
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_company_access(company_id));

CREATE POLICY "shopping_list_items_update" ON public.shopping_list_items
  FOR UPDATE TO authenticated
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

CREATE POLICY "shopping_list_items_delete" ON public.shopping_list_items
  FOR DELETE TO authenticated
  USING (public.user_has_company_access(company_id));
