/**
 * lib/stock — superfície única de validação de estoque da venda.
 *
 * Reexporta `stock-validation`. A leitura de estoque fresco no banco
 * continua sendo responsabilidade da camada de serviço/UI; aqui só
 * vivem as regras puras.
 */
export {
  computeStockInsufficiencies,
  formatInsufficiencyMessage,
} from "./stock-validation";
export type { StockCandidate, StockInsufficiency } from "./stock-validation";
