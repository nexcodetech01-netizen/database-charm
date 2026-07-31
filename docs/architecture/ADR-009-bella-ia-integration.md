# ADR-009 — Integração Bella IA como consumidora de `explain()`

- **Status:** Accepted (Sprint A0.1)
- **Data:** 2026-07-14
- **Escopo:** `src/features/bella-ai/*` e sua relação com Pricing/Tax.

## Contexto
LLMs alucinam números com facilidade. Se Bella IA "calcular" margem/preço/imposto, criará divergência entre o que ela fala e o que o sistema aplica — perda de confiança catastrófica em ERP.

## Decisão
- Bella IA **nunca calcula** preço, margem, imposto ou custo.
- Fluxo obrigatório:
  1. Bella monta `PricingContext.v1`.
  2. Bella chama `compute(context)` → `PricingResult`.
  3. Bella chama `explain(result)` → `PricingExplanation`.
  4. Bella **narra** citando `explainId` e valores do `PricingResult`.
  5. Se sugerir mudança, emite proposta de `PolicyChanged` (ADR-007) — humano aprova.
- Guardrails no system prompt: proibir aritmética sobre valores monetários; exigir citação de `explainId`; recusar responder preço sem `PricingResult` recente.
- Validador de saída checa que números citados por Bella existem no `PricingResult` correspondente.

## Consequências
- **Positivas**: consistência total entre IA e sistema; auditoria da recomendação de IA; guardrails testáveis.
- **Negativas**: latência (2 chamadas + narração) — aceitável; cache de `PricingResult` por sessão mitiga.

## Alternativas rejeitadas
- IA calculando com "tools de matemática": ainda alucina composição de política.
- IA como fonte de preço: viola ADR-001.

## Referências
Blueprint §25, §13; ADR-001, ADR-005, ADR-007.
