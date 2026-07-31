/**
 * Bella Executive Intelligence — barrel público.
 * Módulo isolado; não modifica Services, Providers, Skills nem Action Engine.
 */
export * from "./types";
export { runExecutiveEngine } from "./ExecutiveEngine";
export {
  getExecutiveSummary,
  getExecutiveScore,
  getExecutiveMetrics,
  getExecutiveComparisons,
  getExecutiveRecommendations,
} from "./service.functions";
export {
  invalidateCompanyCache as invalidateExecutiveCache,
} from "./ExecutiveCache";
export * from "./hooks";
