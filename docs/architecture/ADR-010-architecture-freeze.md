# ADR-010 — Architecture Freeze (Sprint A0.1)

- **Status:** Accepted (Sprint A0.1)
- **Data:** 2026-07-14
- **Supersedes:** nenhum.
- **Escopo:** encerramento da fase de desenho arquitetural da Inteligência Comercial.

## Contexto
Após revisão independente (parecer 🟡 → ajustes 1–12) e Sprint A0.1 de hardening, o blueprint incorporou todos os ajustes críticos (§17–§30 do blueprint) e emitiu ADRs 001–009. É necessário formalizar o **freeze** para autorizar implementação sem risco de retrabalho arquitetural durante a Fase 1.

## Decisão
A arquitetura de Inteligência Comercial está **CONGELADA** com o seguinte perímetro normativo:
- Seções §17–§30 de `docs/INTELIGENCIA_COMERCIAL.md`.
- ADR-001 a ADR-009.
- Contratos v1: `PricingContext`, `PricingResult`, `PricingExplanation`, `TaxQuote`, `PriceList`, `CostComposition`, `ChannelContract` e eventos `*.v1`.

Regras do freeze:
1. **Nenhuma alteração arquitetural sem novo ADR** aprovado (superseding).
2. **Contratos v1 imutáveis**: mudanças exigem `v2` + adapter N-1 (ADR-008).
3. **API pública do motor imutável**: apenas `compute` e `explain` exportados (ADR-001).
4. **Bounded Contexts**: violação de fronteira (ADR-006) é bloqueio de code review.
5. **Bella IA**: violação de ADR-009 (calcular localmente) é bloqueio de merge.
6. **Lint arquitetural**: import de `@/features/pricing/engine/*` ou `@/features/pricing/internal/*` fora do próprio módulo é erro de build.

Critérios de freeze atendidos:
- ✅ Sem ambiguidade (contratos versionados, campos tipados).
- ✅ Sem conflito de políticas (merge por atributo com origem — ADR-006).
- ✅ Responsabilidades isoladas (Pricing ↛ Tax ↛ Sales ↛ Finance).
- ✅ Preparada para crescimento (PriceList, ortogonalidade, eventos, N-1).

## Consequências
- **Positivas**: implementação da Fase 1 autorizada; escopo estável; onboarding de novos devs por documento único.
- **Negativas**: qualquer descoberta que exija mudança arquitetural terá custo de ADR + revisão — aceitável e desejável.

## Alternativas rejeitadas
- Freeze parcial: mantém instabilidade e ambiguidade nas fronteiras.
- Não congelar: expõe Fase 1 a retrabalho.

## Próximos passos autorizados
- Sprint de implementação da Fase 1 (motor puro + Company Policy + Simulador), seguindo estritamente §17–§30 e ADR-001..009.

## Referências
Blueprint §17–§30; ADR-001..009.
