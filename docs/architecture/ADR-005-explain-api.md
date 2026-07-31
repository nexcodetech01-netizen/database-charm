# ADR-005 — Explain API: decisões auditáveis

- **Status:** Accepted (Sprint A0.1)
- **Data:** 2026-07-14
- **Escopo:** `explain(result) → PricingExplanation.v1`; `PricingResult` expandido.

## Contexto
Auditoria fiscal, suporte ao cliente ("por que este preço?") e Bella IA precisam de rastreabilidade **por decisão**, não por chamada de função. Sem `explain()`, cada consumidor reconstrói lógica → divergência e alucinação de IA.

## Decisão
- `PricingResult.v1` traz `explainId`, `appliedRules[]` (ordem determinística), `policySource` (origem por atributo), `engineVersion`, `calculationVersion`, `policyVersion`, `contextVersion`, `taxEngineVersion?`, `warnings[]`.
- `explain(result)` retorna `PricingExplanation.v1` com:
  - `summary` (1 linha humana — texto livre, pode mudar)
  - `steps[]` (contrato estável, espelha `appliedRules`)
  - `policyResolutionTree`
  - `invariantsChecked[]`
  - `warnings`
  - `suggestedActions?`
- **Bella IA consome `explain()`** e cita `explainId`. Reconstruir cálculo é bug.
- Cadeia narrativa canônica: **Custo → Alvo → Canal → Imposto → Comportamento → PriceList → Arredondamento → Piso**.
  - `Comportamento` (desconto/markup contextual) aplica sobre o preço-alvo já onerado por canal e imposto — precisa vir depois destes para preservar a semântica do desconto sobre "preço bruto de venda".
  - Composição de custo (`cost + frete + embalagem + seguro + outras despesas`) é responsabilidade EXCLUSIVA do Pricing Engine (`internal/cost.ts` → `composeCostComposition`). Qualquer consumidor que some componentes manualmente é bug arquitetural.
  - Invariante travada em `engine/explain.ts` (`canonicalOrder`) e testada em `engine/__tests__/composition-parity.test.ts`.


## Consequências
- **Positivas**: auditoria reproduzível; UI de "por quê?"; guardrails de IA robustos.
- **Negativas**: manter `steps[]` como contrato estável exige disciplina — separar de `summary` livre.

## Alternativas rejeitadas
- Log textual livre: não auditável, não versionável.
- Recomputar sob demanda: viola reprodutibilidade temporal (custos/políticas mudam).

## Referências
Blueprint §24, §25; ADR-008, ADR-009.
