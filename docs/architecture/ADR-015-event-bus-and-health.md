# ADR-015 — Event Bus do Agente e Health Providers

- **Status:** Accepted (Sprint 001.5)
- **Data:** 2026-07-28
- **Escopo:** `src/features/bella-ai/agent/infrastructure/{event-bus,health}.ts`

## Contexto

Duas necessidades surgiram simultâneas com a Sprint 001.5:

1. Padronizar como o Agente Operacional publica eventos de domínio
   (skill executada, confirmação pedida, fallback) sobre o
   `BellaEventEngine` já existente — sem reinventar barramento.
2. Expor endpoints de saúde para monitoramento sem vazar informação
   interna em rota pública.

## Decisão

### Event Bus (`event-bus.ts`)

Wrapper fino em cima de `bellaEventEngine.emit()`. Regras:

- Payload passa por `sanitizeForAudit` antes de ser publicado.
- `requestId`, `channel`, `userId` são anexados automaticamente do
  `ExecutionContext` para correlação.
- Falha na publicação é logada e engolida — evento NUNCA derruba o
  pipeline principal.

### Health Providers (`health.ts`)

Dois níveis:

- `getPublicHealth()` — resposta mínima `{ status: "ok", ts }`. Sem RBAC,
  sem detalhes. Adequado para rota pública / healthcheck externo.
- `getInternalHealth()` — inclui checagem do Supabase (latência + erro
  agregado). **O consumidor da rota é responsável por gate-ar por
  permissão** (`settings.view` ou owner) antes de expor.

## Consequências

- Eventos do Agente coexistem com eventos legados sem duplicar engine.
- Endpoint público de health não vaza schema/versão/latência.
- Rota interna de health, quando criada, tem contrato pronto.
