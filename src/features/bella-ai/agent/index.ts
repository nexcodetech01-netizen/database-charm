/**
 * Agente Operacional Bella — API pública.
 *
 * Consumidores devem importar SOMENTE deste barrel:
 *
 *   import { handleWithAgentRuntime, type AgentContext } from "@/features/bella-ai/agent";
 */
export * from "./types";
export * from "./infrastructure";
export { canExecuteSkill, hasPermission, getSkillPermissionSpec } from "./permission-engine";
export { planFromIntent } from "./planner";
export { logAgentExecution } from "./execution-log";
export {
  fetchAgentMetrics,
  type AgentMetricsSummary,
  type AgentMetricsWindow,
} from "./observability";
// Removido do barrel para evitar vazamento de código server-only para o cliente
// export { runAgent, type RunAgentInput } from "./agent";
export { isBellaAgentEnabled, setBellaAgentEnabled } from "./config";
export {
  detectRuntimeIntent,
  SUPPORTED_RUNTIME_INTENTS,
  type SupportedRuntimeIntent,
} from "./intent-engine";
// Removido do barrel para evitar vazamento de código server-only para o cliente
// handleWithAgentRuntime importa o pipeline completo que inclui o Registry.
// export {
//   handleWithAgentRuntime,
//   FALLBACK_LOG_PREFIX,
//   type AgentRuntimeInput,
//   type AgentRuntimeResult,
//   type AgentRuntimeTrace,
// } from "./runtime";
// export { FALLBACK_LOG_PREFIX } from "./runtime";
// export type { AgentRuntimeInput, AgentRuntimeResult, AgentRuntimeTrace } from "./runtime";
export const FALLBACK_LOG_PREFIX = "fallback:";
export type { AgentRuntimeInput, AgentRuntimeResult, AgentRuntimeTrace } from "./types";
// runtime.ts foi removido do barrel para evitar vazamento de código server-side.
// Types e constantes seguras devem vir de arquivos separados se necessário,
// mas por enquanto mantemos o essencial via export individual.
export {
  fetchAgentRuntimeMetrics,
  fetchAgentExecutionLog,
  type AgentRuntimeMetricsSummary,
  type AgentRuntimeMetricsWindow,
  type AgentExecutionLogRow,
} from "./metrics";

