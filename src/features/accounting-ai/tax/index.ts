/**
 * Bella Contadora — Tributário (Sprint 7.1): barrel público.
 *
 * Módulo 100% de leitura. Faixas, alíquotas, DAS, RBT12 e projeções vêm do
 * motor tributário oficial (`@/features/tax`). Nada é recalculado aqui.
 */
export * from "./types";
export * from "./links";
export * from "./selectors";
export { taxRegimeProvider, taxSimulationProvider, dueDateFromProfile } from "./provider";
export { buildBellaTaxInsights } from "./insights";
export { buildBellaTaxNotifications } from "./notifications";
export { useBellaTax } from "./use-bella-tax";
export { BellaTaxBlock } from "./bella-tax-block";
export type { BellaTaxBlockProps } from "./bella-tax-block";
