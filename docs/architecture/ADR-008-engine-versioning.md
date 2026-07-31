# ADR-008 — Versionamento do motor & compatibilidade N-1

- **Status:** Accepted (Sprint A0.1)
- **Data:** 2026-07-14
- **Escopo:** versionamento de contratos e reprodutibilidade histórica.

## Decisão
Toda entidade de contrato carrega `version` no formato `dominio/N`:
- `PricingContext.v1`, `PricingResult.v1`, `PricingExplanation.v1`
- `TaxQuote.v1`, `PriceList.v1`, `CostComposition.v1`, `ChannelContract.v1`
- Todos os `*.Event.vN`

Além disso, `PricingResult` traz:
- `engineVersion` (semver do motor)
- `calculationVersion` (identifica fórmula matemática; muda mesmo sem novo engine)
- `policyVersion` (hash determinístico da política resolvida)

Regras de compatibilidade:
- Motor **deve aceitar N e N-1** por, no mínimo, um ciclo de release.
- **Downgrade interno** (adapter) é responsabilidade do motor, invisível ao chamador.
- Nunca remover campo obrigatório sem major bump + política de descontinuação anunciada.
- Reprodução histórica: dado `explainId` + snapshots referenciados, o resultado é **reproduzível** por anos.

## Consequências
- **Positivas**: auditoria fiscal (5+ anos) viável; deploys sem quebra em cascata; consumidores migram no seu ritmo.
- **Negativas**: overhead de manter adapters N-1 — aceitável (custo linear pequeno).

## Alternativas rejeitadas
- Sem versionamento (evoluir "por convenção"): quebras silenciosas garantidas.
- Compatibilidade infinita: impede refactor legítimo.

## Referências
Blueprint §28, §29; todos ADRs acima.
