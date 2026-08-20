-- CAUSA RAIZ REAL de "pedido novo não chega ao vivo, só depois de
-- atualizar a página": a tabela `whatsapp_commercial_inbox` (onde os
-- pedidos reais do catálogo/WhatsApp são gravados) NUNCA foi
-- adicionada à publicação de Realtime do Supabase.
--
-- Isso é uma configuração do BANCO DE DADOS, separada de qualquer
-- código React/TanStack — nenhuma correção no frontend resolveria
-- isso, porque o problema é que o Postgres nunca estava configurado
-- pra AVISAR ninguém sobre mudanças nessa tabela. O código do
-- `useCommercialInboxRealtime` (que escuta INSERT/UPDATE nessa
-- tabela) sempre esteve certo — o canal conectava e confirmava
-- "SUBSCRIBED" normalmente, só nunca recebia nenhum evento de verdade,
-- porque o banco nunca emitia esses eventos pra essa tabela específica.
--
-- Para contraste: a tabela `whatsapp_message_events` (usada nos testes
-- com "n8n-10", que sempre funcionaram) TEM essa mesma habilitação
-- desde 2026-08-19 (migration 20260819005137) — por isso os testes
-- sempre pareciam confirmar que "o sistema de notificação funciona",
-- mas essa tabela específica de pedidos reais nunca tinha sido
-- configurada da mesma forma.

BEGIN;
  -- Habilita a tabela na publicação de Realtime (mesmo padrão já usado
  -- para whatsapp_message_events).
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_commercial_inbox'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_commercial_inbox;
    END IF;
  END $$;

  -- REPLICA IDENTITY FULL: garante que eventos de UPDATE tragam todos
  -- os campos (não só a chave primária) — o hook também escuta UPDATE
  -- (quando um pedido é resolvido em outra aba/atendente).
  ALTER TABLE public.whatsapp_commercial_inbox REPLICA IDENTITY FULL;
COMMIT;
