/**
 * Bella Automations — barrel público.
 *
 * NOTA: AutomationEngine e AutomationRunner foram removidos do barrel
 * para evitar vazamento de código server-only (Registry) para o cliente.
 * Consumidores de UI devem usar apenas types e componentes.
 */
export * from "./types";
export { AutomationScheduler } from "./AutomationScheduler";
export { AutomationConditions } from "./AutomationConditions";
export { AutomationActions, DESTRUCTIVE_SKILL_IDS } from "./AutomationActions";
export { AutomationValidator } from "./AutomationValidator";
export { AUTOMATION_TEMPLATES, getTemplate } from "./templates";
export type { AutomationTemplate } from "./templates";
export * from "./hooks";
export { BellaAutomationsPanel } from "./components/BellaAutomationsPanel";
