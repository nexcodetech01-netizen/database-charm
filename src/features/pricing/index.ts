/**
 * Inteligência de Precificação — barrel export.
 * Reutilizável por: Produtos, Compras, Vendas, Dashboard e Bella IA.
 */
export * from "./types";
export * from "./calculator";
export { usePricingPolicy } from "./hooks/use-pricing-policy";
export { PricingPolicyForm } from "./components/pricing-policy-form";
export { PricingSimulator } from "./components/pricing-simulator";
export { PricingStatusBadge } from "./components/pricing-status-badge";
export {
  ProductPricingSheet,
  type ProductPricingSheetProduct,
} from "./components/product-pricing-sheet";
export { SuggestedPricesByChannelCard } from "./components/suggested-prices-by-channel-card";
