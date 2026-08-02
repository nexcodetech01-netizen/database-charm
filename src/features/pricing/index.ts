/**
 * Inteligência de Precificação — barrel export.
 *
 * MOTOR ÚNICO (FASE 1/2): todo cálculo de preço passa por
 * `@/features/pricing/official` → `engine/compute.ts`.
 * O antigo `calculator.ts` foi REMOVIDO — não existe mais fórmula paralela.
 */
export * from "./types";
export * from "./official";
export {
  resolvePricingStatus,
  type PricingStatus,
  type PricingStatusView,
} from "./official/status";
export { usePricingPolicy } from "./hooks/use-pricing-policy";
export { useCompanyFeeTable } from "./hooks/use-company-fee-table";
export { PricingPolicyForm } from "./components/pricing-policy-form";
export { PricingSimulator } from "./components/pricing-simulator";
export { PricingStatusBadge } from "./components/pricing-status-badge";
export {
  ProductPricingSheet,
  type ProductPricingSheetProduct,
} from "./components/product-pricing-sheet";
export { SuggestedPricesByChannelCard } from "./components/suggested-prices-by-channel-card";
