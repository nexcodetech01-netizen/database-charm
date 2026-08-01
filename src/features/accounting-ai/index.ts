/**
 * Bella Contadora (`features/accounting-ai`) — barrel público.
 *
 * Módulo independente e somente leitura: consome exclusivamente os serviços
 * já existentes do NexOS (Accounting, Finance, Sales, Inventory, Fiscal, Cash).
 */
export * from "./types";
export * from "./lib";
export * from "./services";
export * from "./providers";
export { buildAccountingSummary } from "./providers/summary";
export * from "./skills";
export * from "./queries";
export * from "./insights";
export * from "./advisor";
export {
  buildBellaNotifications,
  buildTopNotifications,
  countCriticalNotifications,
  bellaNotificationStore,
  useBellaNotifications,
  useBellaCriticalCount,
  PROACTIVE_REGISTRY,
} from "./proactive";
export type {
  BellaNotification,
  NotificationCategory,
  NotificationSeverity,
  ProactiveInput,
  ProactiveOptions,
} from "./proactive";
export * from "./finance";
export * from "./fiscal";
export * from "./inventory";
export * from "./reports";
export * from "./automations";
export * from "./components";
export * from "./chat";
export { useAccountingAiSummary } from "./hooks/use-accounting-ai";
export { useBellaChat } from "./hooks/use-bella-chat";
export { BellaContadoraDashboard } from "./dashboard";
