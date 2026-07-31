/**
 * lib/pricing — leitura de preço/custo/margem no contexto da venda.
 *
 * O motor de precificação oficial vive em `@/features/pricing` (ADR-001)
 * e continua sendo a única fonte de preço sugerido. Aqui ficam apenas as
 * derivações de margem sobre o item já colocado no carrinho.
 */
export { computeItemMargin, computeSaleMetrics } from "../types";
