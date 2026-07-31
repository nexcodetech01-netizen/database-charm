# Architecture Decision Records — NexOS

ADRs vinculantes emitidos na **Sprint A0.1 — Architecture Hardening**.
Referência normativa: [`docs/INTELIGENCIA_COMERCIAL.md`](../INTELIGENCIA_COMERCIAL.md) (§17–§30).

| ID | Título | Status |
|---|---|---|
| [ADR-001](./ADR-001-pricing-engine.md) | Pricing Engine — motor puro, API mínima, estratégias ortogonais | Accepted |
| [ADR-002](./ADR-002-tax-engine.md) | Tax Engine como domínio separado | Accepted |
| [ADR-003](./ADR-003-price-list.md) | Price List (PriceBook) como modo alternativo | Accepted |
| [ADR-004](./ADR-004-pricing-context.md) | PricingContext v1 congelado | Accepted |
| [ADR-005](./ADR-005-explain-api.md) | Explain API — decisões auditáveis | Accepted |
| [ADR-006](./ADR-006-policy-hierarchy.md) | Hierarquia de políticas & Bounded Contexts | Accepted |
| [ADR-007](./ADR-007-domain-events.md) | Eventos de domínio versionados | Accepted |
| [ADR-008](./ADR-008-engine-versioning.md) | Versionamento do motor & compat N-1 | Accepted |
| [ADR-009](./ADR-009-bella-ia-integration.md) | Integração Bella IA — consumidor de `explain()` | Accepted |
| [ADR-010](./ADR-010-architecture-freeze.md) | Freeze arquitetural — Sprint A0.1 | Accepted |

Formato: cada ADR segue *Context → Decision → Consequences → Alternatives → Status*.
Alterações exigem novo ADR (superseding) — nunca editar um ADR aceito.
