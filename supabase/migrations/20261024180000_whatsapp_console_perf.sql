-- =====================================================================
-- Performance do Console WhatsApp (2026-10-24)
--
-- A tela de conversas ficava lenta porque:
--  - a lista buscava TODAS as mensagens das 100 conversas só para mostrar a
--    última de cada uma;
--  - as tabelas de mensagens/conversas não tinham índices para os filtros
--    usados (conversa + data, empresa + data).
--
-- Índices com IF NOT EXISTS: se já existirem com este nome, nada muda.
-- =====================================================================

begin;

-- Mensagens de uma conversa em ordem de data (detalhe + última mensagem).
create index if not exists whatsapp_messages_conversation_created_idx
  on public.whatsapp_messages (conversation_id, created_at desc);

-- Mensagens da empresa por data (métricas "mensagens hoje", tempo médio).
create index if not exists whatsapp_messages_company_created_idx
  on public.whatsapp_messages (company_id, created_at desc);

-- Lista de conversas da empresa ordenada por atualização.
create index if not exists whatsapp_conversations_company_updated_idx
  on public.whatsapp_conversations (company_id, updated_at desc);

-- Inbox comercial da empresa ordenado por data.
create index if not exists whatsapp_commercial_inbox_company_created_idx
  on public.whatsapp_commercial_inbox (company_id, created_at desc);

-- Última mensagem de cada conversa, em uma consulta só (usa o índice acima).
-- SECURITY INVOKER: a RLS de whatsapp_messages continua valendo.
create or replace function public.whatsapp_last_messages(_conversation_ids uuid[])
returns table (
  conversation_id uuid,
  text text,
  created_at timestamptz,
  direction text,
  provider text
)
language sql
stable
security invoker
set search_path = public
as $$
  select l.conversation_id, l.text, l.created_at, l.direction, l.provider
    from unnest(_conversation_ids) as c(id)
    cross join lateral (
      select m.conversation_id, m.text, m.created_at, m.direction, m.provider
        from public.whatsapp_messages m
       where m.conversation_id = c.id
       order by m.created_at desc
       limit 1
    ) l;
$$;

revoke execute on function public.whatsapp_last_messages(uuid[]) from public, anon;
grant execute on function public.whatsapp_last_messages(uuid[]) to authenticated, service_role;

commit;
