/**
 * Bella Executive Intelligence — ponto único de entrada do módulo.
 *
 * Módulo isolado: consome apenas os motores existentes via RPC
 * `generate_executive_summary`. Não altera nenhum módulo auditado.
 */

export * from "./types";
export { executiveService, buildExecutiveReport } from "./services/executive.service";
export type { ExecutiveService } from "./services/executive.service";
export { executiveProvider, executiveQuery } from "./providers/executive.provider";
export { executiveSkills } from "./skills/executive-skills";
export { computeExecutiveKpis, kpiValue } from "./lib/kpis";
export { detectExecutiveInsights, INSIGHT_THRESHOLDS } from "./lib/insights";
export { buildExecutiveAlerts } from "./lib/alerts";
export { buildExecutiveForecast, HORIZONS, trendFactor } from "./lib/forecast";
export { assessExecutiveRisk } from "./lib/risk";
export { buildExecutiveRecommendations } from "./lib/recommendations";
export { rankProducts, rankCustomers, rankSuppliers } from "./lib/rankings";
export { toExecutiveSnapshot } from "./lib/normalize";
