# Plano de Implementação - Observabilidade de Payload (Inbox Comercial)

Para monitorar o consumo de saída de dados (egress) após as otimizações do Inbox Comercial, implementaremos um sistema de logging de métricas de query.

## 1. Banco de Dados
Criar uma tabela `query_metrics` para registrar o tamanho dos payloads das consultas do Inbox.

```sql
create table public.query_metrics (
    id uuid primary key default gen_random_uuid(),
    query_name text not null,
    payload_size_kb numeric(10,2) not null,
    company_id uuid references public.companies(id),
    created_at timestamptz default now()
);

grant insert, select on public.query_metrics to authenticated;
grant all on public.query_metrics to service_role;

alter table public.query_metrics enable row level security;

-- Política simples para leitura (admins ou usuários da mesma empresa)
create policy "Users can view metrics for their company"
on public.query_metrics for select
to authenticated
using (company_id::text = (auth.jwt() ->> 'company_id'));
```

## 2. Infraestrutura de Logging (Frontend/Client)
Criar `src/lib/metrics.ts` com uma função utilitária `logQueryMetric` que grava na tabela de forma "best-effort" (não bloqueante).

## 3. Instrumentação das Queries
Alterar `src/features/whatsapp/hooks/use-commercial-inbox.ts` para capturar o tamanho do payload retornado nas funções `useCommercialInbox` (listagem) e `useCommercialInboxDetail` (detalhes).

## 4. Painel de Diagnóstico
Implementar uma nova rota `src/routes/_authenticated/ferramentas.metricas-inbox.tsx` que exibe:
- Médias de KB por query (24h / 7 dias).
- Contagem de chamadas por tipo.
- Tabela de resumo de performance.

## Detalhes Técnicos
- O tamanho do payload será estimado via `JSON.stringify(data).length / 1024`.
- A gravação será disparada após o retorno da query do Supabase, sem usar `await` para não atrasar a renderização da UI.
