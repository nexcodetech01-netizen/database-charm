-- BUG: mesma causa raiz já corrigida em resellers/consignacoes/
-- consignment_items/consignment_settlements (migration
-- 20260819220531) — as políticas de `query_metrics` usam
-- `(auth.jwt() ->> 'company_id')`, um claim que nunca é populado no
-- token de autenticação deste sistema. Isso explica o erro 403
-- observado ao tentar gravar em `query_metrics` (o painel de
-- monitoramento de payload do Inbox Comercial, Ferramentas > Métricas
-- de Payload): a política de INSERT nunca é satisfeita, sempre bloqueia.

DROP POLICY IF EXISTS "Users can view metrics for their company" ON public.query_metrics;
DROP POLICY IF EXISTS "Users can insert metrics for their company" ON public.query_metrics;

CREATE POLICY "query_metrics_select" ON public.query_metrics
    FOR SELECT
    TO authenticated
    USING (public.user_owns_company(company_id));

CREATE POLICY "query_metrics_insert" ON public.query_metrics
    FOR INSERT
    TO authenticated
    WITH CHECK (public.user_owns_company(company_id));
