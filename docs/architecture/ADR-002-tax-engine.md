# ADR-002 — Tax Engine como domínio separado

- **Status:** Accepted (Sprint A0.1)
- **Data:** 2026-07-14
- **Escopo:** novo domínio `Tax`; contrato `TaxQuote.v1`

## Contexto
Legislação tributária brasileira muda continuamente (Simples por faixa, ICMS por UF de destino, PIS/COFINS por regime, DIFAL, Reforma Tributária). Misturar tributação com precificação acopla o motor a mudanças fiscais e impede atualizações fiscais independentes.

## Decisão
- Extrair impostos completamente do Pricing Engine.
- Criar o domínio conceitual **Tax Engine** com API `computeTax(taxContext) → TaxQuote.v1`.
- Pricing **nunca calcula imposto**. Recebe `TaxQuote` no `PricingContext` e aplica como camada linear (percentual + fixo).
- Ausência de `TaxQuote` quando política exige tributo → warning `TAX_QUOTE_MISSING` e preço marcado como pré-imposto.
- `TaxQuote` carrega `taxEngineVersion`, `validFrom/validTo`, `quoteId` (idempotência).

## Consequências
- **Positivas**: deploys fiscais independentes; testabilidade fiscal isolada; Reforma Tributária absorvida sem tocar Pricing.
- **Negativas**: cotações podem expirar durante venda longa (orçamento) → requer re-cotação em `PriceApplied` (mitigação em §29).

## Alternativas rejeitadas
- Tributos dentro do Pricing Engine (blueprint original): acopla mudanças fiscais mensais ao coração comercial.
- Tributos como estratégia: viola ortogonalidade (ADR-001).

## Referências
Blueprint §19; ADR-001, ADR-004, ADR-008.
