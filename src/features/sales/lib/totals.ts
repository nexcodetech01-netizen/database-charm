/**
 * lib/totals — ponto único de cálculo de totais da venda.
 *
 * Não reimplementa nada: reexporta as funções puras já validadas em
 * `../types` para que Engine/Store/PDV nunca importem regra de cálculo
 * de dentro de um componente.
 */
export {
  computeItemTotal,
  computeItemMargin,
  computeTotals,
  computeSaleMetrics,
} from "../types";
