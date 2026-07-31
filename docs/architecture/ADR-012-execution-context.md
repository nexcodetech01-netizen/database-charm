# ADR-012 — ExecutionContext / RequestContext / SecurityContext

- **Status:** Accepted (Sprint 001.5)
- **Data:** 2026-07-28
- **Escopo:** `src/features/bella-ai/agent/infrastructure/context.ts`

## Contexto

O Agente Operacional (ADR-011) já tinha `AgentContext`, mas Skills/Services
não recebiam de forma padronizada informações de rastreio (requestId,
canal), permissões pré-resolvidas nem o cliente Supabase autenticado.
Cada Skill lia `supabase` do módulo global — o que dificultava testes,
observabilidade e propagação de trace.

## Decisão

Introduzir um `ExecutionContext` único, composto por três subcontextos:

- **RequestContext** — `requestId`, `channel`, `startedAt`, `locale`.
- **SecurityContext** — `permissions` (Set imutável), `isOwner`, método
  `can(codes)` com atalho de owner (`*`).
- **ExecutionContext** — agrega `companyId`, `userId`, `conversationId`,
  `request`, `security`, e o cliente `supabase` autenticado.

Construção via `buildExecutionContext()` — fabrica um trace id novo
quando não informado.

## Consequências

- BaseSkill/BaseService **exigem** ExecutionContext; Skill que ainda usa
  `BellaSkillContext` continua funcionando (compat aditiva), mas migração
  progressiva expõe `security.can()` em vez de checagem manual.
- Nunca carrega credenciais brutas — auditoria/log podem serializar o
  contexto sem risco.
- `supabaseAdmin` continua proibido nesta camada (ver ADR-016).
