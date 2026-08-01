/**
 * Bella Contadora — CRM (Sprint 6.6): barrel público.
 * Camada de leitura/apresentação; nenhuma regra de cliente nova.
 */
export * from "./types";
export * from "./links";
export * from "./selectors";
export { useBellaCrm } from "./use-bella-crm";
export { BellaCrmPanel } from "./bella-crm-panel";
export type { BellaCrmPanelProps } from "./bella-crm-panel";
export { BellaCrmSummary } from "./bella-crm-summary";
export type { BellaCrmSummaryProps } from "./bella-crm-summary";
export { BellaCrmAlerts } from "./bella-crm-alerts";
export type { BellaCrmAlertsProps } from "./bella-crm-alerts";
export { BellaCrmRecommendations } from "./bella-crm-recommendations";
export type { BellaCrmRecommendationsProps } from "./bella-crm-recommendations";
export { BellaCrmActions } from "./bella-crm-actions";
export type { BellaCrmActionsProps } from "./bella-crm-actions";
