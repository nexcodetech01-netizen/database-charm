/**
 * Bella Operational Agent — tipos públicos.
 *
 * Camada NOVA e ADITIVA sobre a Bella IA existente. Nenhum consumidor
 * atual é obrigado a migrar; quem quiser executar Skills seguindo o
 * pipeline canônico (Intent → Planner → Permission → Skill → Log)
 * chama `runAgent()` deste módulo.
 *
 * Regras:
 *  - Nenhuma etapa toca Supabase diretamente exceto o ExecutionLogger.
 *  - Skills continuam sendo a única porta para Business Services.
 *  - Confirmações destrutivas nunca são executadas sem `confirmed:true`.
 */
import type { PermissionCode } from "@/features/rbac/lib/permission-codes";
import type { BellaSkillMissingField, BellaSkillResult } from "../skills/types";

export interface AgentContext {
  companyId: string;
  /** Nome de exibição da empresa, usado no prompt da IA (opcional). */
  companyName?: string | null;
  userId?: string | null;
  conversationId?: string | null;
  /** Permissões efetivas do usuário (união dos roles). Owner recebe {"*"}. */
  permissions: Set<string> | ReadonlySet<string>;
  isOwner?: boolean;
  /** Cliente Supabase autenticado — RLS aplicada como o usuário. */
  supabase?: any;
}

export interface AgentIntent {
  id: string; // ex.: "customer.create"
  confidence: number; // 0..1
  entities: Record<string, unknown>;
  raw: string; // mensagem original
  confirmationRequired: boolean;
  source: "deterministic" | "llm";
}

export interface AgentPlanStep {
  order: number;
  skillId: string;
  description: string;
  payload: Record<string, unknown>;
  /** Quando true, o Agent para se este passo falhar. */
  critical?: boolean;
}

export interface AgentPlan {
  intentId: string;
  requiresConfirmation: boolean;
  confirmationSummary?: string;
  /** Dados ricos para o ActionCard (ex.: delta de estoque, nome do produto) */
  confirmationData?: Record<string, unknown>;
  steps: AgentPlanStep[];
}

export type AgentOutcomeCode =
  | "executed"
  | "needs_confirmation"
  | "needs_more_info"
  | "not_allowed"
  | "unknown_intent"
  | "error";

export interface AgentStepResult {
  step: AgentPlanStep;
  result: BellaSkillResult;
}

export interface AgentSuggestion {
  id: string;
  title: string;
  actionLabel?: string;
}

export interface AgentResponse {
  code: AgentOutcomeCode;
  message: string;
  intent: AgentIntent | null;
  plan?: AgentPlan;
  steps: AgentStepResult[];
  missingFields?: BellaSkillMissingField[];
  suggestions?: AgentSuggestion[];
}

export interface AgentRuntimeResult {
  response: AgentResponse | null;
  trace: AgentRuntimeTrace;
}

export interface AgentRuntimeInput {
  message: string;
  ctx: AgentContext;
  confirmed?: boolean;
  gateway?: any;
}

export interface AgentRuntimeTrace {
  enabled: boolean;
  intent: AgentIntent | null;
  fallback: boolean;
  fallbackReason?: string;
  executionTimeMs: number;
  response?: AgentResponse;
  telemetry?: {
    provider: string;
    model?: string;
    latencyMs?: number;
    fallbackUsed?: boolean;
  };
}

/** Metadados que o PermissionEngine devolve para cada skill. */
export interface SkillPermissionSpec {
  skillId: string;
  requires: PermissionCode[]; // basta ter UMA
  destructive: boolean; // exige confirmação
}
