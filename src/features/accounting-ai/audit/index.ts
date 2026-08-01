/**
 * Bella Contadora — Auditoria (Sprint 7.2): barrel público.
 * Módulo 100% de leitura: identifica inconsistências e nunca corrige.
 */
export * from "./types";
export * from "./links";
export * from "./selectors";
export * from "./queries";
export { AUDIT_RULES, AUDIT_CATEGORY_LABELS } from "./rules";
export { auditProvider, runAuditRules, computeAuditHealth } from "./provider";
export { buildBellaAuditInsights } from "./insights";
export {
  buildBellaAuditNotifications,
  type AuditPreviousState,
} from "./notifications";
export { useBellaAudit } from "./use-bella-audit";
export { BellaAuditBlock } from "./bella-audit-block";
export type { BellaAuditBlockProps } from "./bella-audit-block";
