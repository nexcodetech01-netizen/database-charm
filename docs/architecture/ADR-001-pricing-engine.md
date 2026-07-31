# ADR-001 — Pricing Engine: motor puro, API mínima, estratégias ortogonais

- **Status:** Accepted (Sprint A0.1)
- **Data:** 2026-07-14
- **Escopo:** `src/features/pricing/*`

## Contexto
Precificação hoje é calculada em vários pontos (Produtos, Compras, Vendas, Simulador). Divergência é inevitável. O blueprint original (§2.2) propôs um motor centralizado, mas com API larga (`resolvePolicy`, `applyChannel`, `applyStrategy`, `round`, `evaluate`, `compute`) e um objeto único `PricingStrategy` que aglutinava três decisões distintas (margem-alvo, comportamento comercial, arredondamento).

## Decisão
1. **Motor puro**: zero I/O, zero clock, zero random. Clock e FX entram pelo `PricingContext`.
2. **API pública mínima do barrel `@/features/pricing`**:
   - `compute(context) → PricingResult`
   - `explain(result) → PricingExplanation`
   Todo o resto é **interno** (não exportado).
3. **Estratégias ortogonais em três eixos independentes**:
   - `MarginTarget` (min | ideal | premium | custom%)
   - `CommercialBehavior` (standard | high_turnover | promotion | stock_burn)
   - `RoundingPolicy` (none | integer | end_90 | end_99 | psychological)
   O objeto `PricingStrategy` monolítico é **abolido**.

## Consequências
- **Positivas**: superfície testável e paralelizável; combinatória explícita; motor portável (Edge/Worker/CLI); Bella IA e UIs consomem uma única entrada.
- **Negativas**: consumidores que precisavam de subfunções (`round`, `evaluate`) devem obtê-las via `explain(result)`. Custo de disciplina para não reintroduzir presets.

## Alternativas rejeitadas
- **API larga com helpers exportados**: reintroduz cálculo local em consumidores.
- **Estratégia enum única**: explode combinatoriamente e esconde regras.

## Referências
Blueprint §18, §22.
