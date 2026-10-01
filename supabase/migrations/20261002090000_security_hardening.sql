-- =====================================================================
-- Endurecimento de segurança (auditoria de 2026-10-01)
--
-- 1. Bella Pay: as 3 RPCs do webhook voltam a ser só de servidor.
--    Desde 20260826 estavam liberadas para "anon" porque o webhook usava a
--    chave pública. bella_pay_apply_webhook_result confia nos IDs que
--    recebe (cobrança, venda, empresa) e dá baixa no financeiro — com a
--    chave pública (que vai no navegador de qualquer visitante) dava para
--    marcar vendas como pagas. O webhook agora usa service role.
--
-- 2. Catálogo: a política pública de produtos liberava TODAS as colunas
--    (inclusive custo e margem) para visitantes, via API. As páginas do
--    catálogo leem pelo servidor (service role) e não usam essa política.
--
-- 3. company_card_price_config: mesma situação (taxa do cartão de todas
--    as empresas legível por visitantes); o catálogo lê pelo servidor.
-- =====================================================================

-- 1) Bella Pay
REVOKE EXECUTE ON FUNCTION public.bella_pay_resolve_webhook_token(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bella_pay_record_webhook_event(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bella_pay_apply_webhook_result(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bella_pay_resolve_webhook_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bella_pay_record_webhook_event(uuid, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bella_pay_apply_webhook_result(uuid, jsonb, jsonb) TO service_role;

-- 2) Produtos: sem leitura pública
DROP POLICY IF EXISTS "Public can view active catalog products" ON public.products;
REVOKE SELECT ON public.products FROM anon;

-- 3) Configuração do preço no cartão: sem leitura pública
DROP POLICY IF EXISTS "company_card_price_config_public_select" ON public.company_card_price_config;
REVOKE SELECT ON public.company_card_price_config FROM anon;
