# ADR-004 — PricingContext v1 congelado

- **Status:** Accepted (Sprint A0.1)
- **Data:** 2026-07-14
- **Escopo:** contrato `PricingContext.v1` (e `CostComposition.v1`, `ChannelContract.v1` referenciados).

## Decisão
Congelar `PricingContext.v1` com campos suficientes para 10 anos, mesmo que a Fase 1 não use todos. Campos futuros permanecem **opcionais** no schema para evitar breaks.

Campos v1 (detalhe em §21 do blueprint): `contextVersion`, `company`, `category?`, `product`, `channel?` (ChannelContract), `customerSegment?`, `quantity`, `store?`, `currency`, `clock`, `taxQuote?`, `priceList?`, `fxRate?`, `costComposition`, `marginTarget?`, `commercialBehavior?`, `roundingPolicy?`, `requestId`, `requestedBy`.

- **Clock injetado**: motor não lê `Date.now`.
- **Currency obrigatório**: v1 sempre `BRL`, mas presente no contrato.
- **Adicionar campo opcional = minor**. **Remover/renomear = major** (ADR-008).

## Consequências
- **Positivas**: expansão para multi-loja, multi-moeda, segmento B2B, preço tabelado sem major bump; contratos estáveis para Bella IA e Sales.
- **Negativas**: consumidores da Fase 1 precisam entender que campos existem mesmo sem uso — mitigação via typing e defaults.

## Alternativas rejeitadas
- Contrato minimalista v1 e crescer por breaks: gera cascata de migrações em consumidores.
- Contrato aberto (`Record<string, unknown>`): perde segurança de tipo e auditabilidade.

## Referências
Blueprint §21; ADR-001, ADR-008.
