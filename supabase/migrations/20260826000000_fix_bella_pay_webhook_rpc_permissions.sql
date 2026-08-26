-- CAUSA RAIZ REAL do "webhook do Asaas pausado há 7 dias por erros"
-- (2026-08-26).
--
-- O webhook do Bella Pay (`/api/public/bella-pay/webhook/{token}`) foi
-- desenhado de propósito pra funcionar SEM a chave de serviço mais
-- privilegiada do Supabase (`SUPABASE_SERVICE_ROLE_KEY`) — ele usa só
-- a chave pública (`SUPABASE_PUBLISHABLE_KEY`), e toda operação
-- privilegiada passa por 3 funções SECURITY DEFINER
-- (`bella_pay_resolve_webhook_token`, `bella_pay_record_webhook_event`,
-- `bella_pay_apply_webhook_result`) — isso está documentado no próprio
-- código do webhook (comentário "HOTFIX-004D").
--
-- A migration `20260801191645_...` (hardening de segurança geral)
-- revogou a permissão de EXECUTAR essas 3 funções de `anon` (e
-- `authenticated`), deixando só `service_role` — sem perceber que o
-- webhook NUNCA usa `service_role`, só a chave pública (que atua como
-- `anon`). Resultado: toda chamada de webhook da Asaas, desde então,
-- falhava JÁ NA PRIMEIRA ETAPA (resolver o token) com "permissão
-- negada" — e depois de falhar repetidamente por dias seguidos, a
-- própria Asaas pausa o envio de novos eventos automaticamente (é
-- esse aviso "sincronização pausada há 7 dias" que chegou por e-mail).
--
-- Isso não é uma falha de segurança real: as 3 funções já validam
-- tudo que precisam internamente (o token da URL + o cabeçalho
-- `asaas-access-token`) — a permissão de EXECUTAR a função sozinha não
-- dá acesso a nada, só permite chamar a função, que por sua vez checa
-- as credenciais de verdade. Devolver a permissão pra `anon` só
-- restaura o funcionamento original documentado no código.

GRANT EXECUTE ON FUNCTION public.bella_pay_resolve_webhook_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.bella_pay_record_webhook_event(uuid, text, text, text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.bella_pay_apply_webhook_result(uuid, jsonb, jsonb) TO anon;
