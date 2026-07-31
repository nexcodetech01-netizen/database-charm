# ADR-003 — Price List (PriceBook) como modo alternativo

- **Status:** Accepted (Sprint A0.1)
- **Data:** 2026-07-14
- **Escopo:** contrato `PriceList.v1`; modos `derived` | `tabled`.

## Contexto
PMEs operam **dois modelos** de precificação simultaneamente: (a) preço derivado do custo + política; (b) preço tabelado (contratos B2B, campanhas de rede, MAP de fornecedor, tabela regulada). O blueprint original só previa o modo derivado, o que forçaria implementação futura invasiva.

## Decisão
- Motor suporta dois modos via mesmo `compute(context)`:
  - **derived**: sem `priceList` → hierarquia de políticas aplicada.
  - **tabled**: `priceList` presente e aplicável → motor **usa** o preço tabelado e **valida** (piso, canal, tributo).
- Precedência: PriceList ativa e aplicável **vence** o derivado.
- Se preço tabelado violar piso: warning `TABLED_PRICE_BELOW_FLOOR`, motor não sobrescreve (respeita contrato humano); Sales bloqueia.
- `PriceList.v1` inclui `scope` (canais, segmentos, lojas, janela), `entries` (com `minQty/maxQty` opcionais), `fallback` (`derived | reject`), `priority` e `version`.
- Evento `PriceListChanged.v1` (ADR-007) notifica invalidação.

## Consequências
- **Positivas**: adicionar tabela de rede B2B amanhã sem tocar motor; mesmo `PricingResult` (com `mode: 'tabled'`) para consumidores.
- **Negativas**: duas trilhas mentais para o operador — mitigação via UI que sempre mostra o modo aplicado.

## Alternativas rejeitadas
- **Só derivado**: impossibilita contratos B2B e campanhas de rede.
- **Só tabelado**: perde inteligência de política — regressão.
- **Dois motores**: duplica manutenção e diverge.

## Referências
Blueprint §23; ADR-001, ADR-007.
