# ADR-006 — Hierarquia de políticas & Bounded Contexts

- **Status:** Accepted (Sprint A0.1)
- **Data:** 2026-07-14
- **Escopo:** merge de políticas; fronteira de Pricing / Sales / Tax / Finance / Inventory / Products / Marketing / Bella IA.

## Decisão
### Merge por atributo
Hierarquia resolvida **campo a campo**, não em bloco:
```
ProductOverride → CategoryPolicy → CompanyPolicy → SystemDefaults
```
Cada campo do `PricingResult` declara sua origem em `policySource`.

### Bounded Contexts
| Contexto | Dono de | Não faz |
|---|---|---|
| Pricing | motor, políticas, PriceList | tributo, canal, persistir venda |
| Tax | `TaxQuote` | margem/preço |
| Sales | Channel, orquestração, `PriceApplied` | calcular preço |
| Finance | reconciliação realizada | recalcular |
| Inventory | estoque, WAC, `CostComposition` | precificar |
| Products | cadastro, categoria, overrides | calcular |
| Marketing | campanhas, `PromotionRequest` | calcular |
| Bella IA | interpretar, propor | calcular preço ou imposto |

Comunicação entre contextos: **apenas via contratos versionados ou eventos de domínio (ADR-007)**. Nenhum contexto importa internals de outro.

**Channel sai do Pricing** e passa a ser cadastro de Sales, injetado no `PricingContext` como `ChannelContract.v1`.

## Consequências
- **Positivas**: contextos evoluem em paralelo; equipes podem se especializar; troca de implementação de um contexto é local.
- **Negativas**: mais contratos para manter — mitigação via ADR-008 (versionamento N-1).

## Alternativas rejeitadas
- Merge em bloco (política vence outra inteira): perde granularidade e explicabilidade.
- Canal no Pricing: acopla marketplaces (SLA, comissão tier) ao motor.

## Referências
Blueprint §17, §20; ADR-001, ADR-007.
