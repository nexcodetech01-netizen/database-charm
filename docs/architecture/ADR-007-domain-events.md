# ADR-007 — Eventos de domínio versionados

- **Status:** Accepted (Sprint A0.1)
- **Data:** 2026-07-14
- **Escopo:** contratos de eventos entre Bounded Contexts (§17, §27).

## Decisão
Definir eventos de domínio **imutáveis e versionados** (`.vN`) como forma primária de comunicação entre contextos:

| Evento | Emissor | Consumidores |
|---|---|---|
| `PolicyChanged.v1` | Products/Config | Pricing (invalida cache), Bella IA, Auditoria |
| `CostRecomputed.v1` | Inventory | Pricing (reavaliação), Dashboard, Bella IA |
| `PriceRecommended.v1` | Pricing | Bella IA, Marketing, Sales |
| `PriceApplied.v1` | Sales | Finance, Auditoria, Relatórios |
| `PriceListChanged.v1` | Products/Config | Pricing, Sales, Bella IA |
| `TaxQuoteIssued.v1` | Tax | Pricing, Sales |

Regras:
- Todo evento carrega `occurredAt`, `actor`, `correlationId`, `version`.
- Payload contém **snapshot mínimo**, nunca referência para objeto vivo de outro contexto.
- Fase 1: entrega **in-process** (event bus síncrono/assíncrono interno). Migração para broker externo (fila) é decisão futura sem alterar contratos.
- Reação a evento é **opt-in** por consumidor; contexto emissor não conhece consumidores.

## Consequências
- **Positivas**: baixo acoplamento; extensão por assinatura, não por edição; auditoria natural.
- **Negativas**: eventual consistency — Bella IA pode ler antes de Cache invalidar. Mitigação: idempotência por `correlationId`.

## Alternativas rejeitadas
- Chamadas diretas entre contextos: reacopla e viola ADR-006.
- Eventos sem versão: quebras silenciosas em consumidores.

## Referências
Blueprint §27; ADR-006, ADR-008.
