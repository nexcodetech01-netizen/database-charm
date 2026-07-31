/**
 * Bella Contadora — módulo de insights (barrel público).
 * Camada pura: engine + regras + helpers + tipos.
 */
export * from "./types";
export * from "./helpers";
export {
  buildAccountingInsights,
  buildAccountingAlerts,
  buildAccountingInsightGroups,
  buildAccountingRecommendations,
} from "./engine";
export { INSIGHT_RULES, cashCoverageDays } from "./rules";
