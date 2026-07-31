/**
 * Bella Workflow Engine — Types
 *
 * Camada de orquestração que compõe múltiplas Skills em fluxos.
 * NUNCA implementa regra de negócio própria — apenas coordena Skills existentes.
 *
 * Fora de escopo:
 *  - Execução paralela.
 *  - Automações agendadas.
 *  - IA tomando decisões.
 *  - Rollback automático.
 */

import type {
  BellaSkillPayload,
  BellaSkillResult,
} from "../skills/types";

/** Status oficial de um workflow em execução. */
export type BellaWorkflowStatus =
  | "PENDING"
  | "RUNNING"
  | "WAITING_USER"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

/** Descrição declarativa de um passo — 1 Step = 1 Skill. */
export interface BellaWorkflowStep {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly skillId: string;
  /**
   * Constrói o payload da Skill a partir dos parâmetros já coletados
   * pelo workflow (state.collectedParameters + saídas de steps anteriores).
   * Puro — sem side-effects, sem acesso a Services.
   */
  buildPayload(input: BellaWorkflowStepInput): BellaSkillPayload;
  /**
   * Extrai chaves relevantes do resultado do Step para propagar aos próximos
   * passos (ex.: `customerId` gerado, `quoteId` criado). Puro.
   */
  extractOutputs?(result: BellaSkillResult): Record<string, unknown>;
  /** Sobrescreve o `requiresConfirmation` da Skill para este step (opt-in). */
  readonly requiresConfirmation?: boolean;
}

export interface BellaWorkflowStepInput {
  readonly collectedParameters: Readonly<Record<string, unknown>>;
  readonly previousOutputs: Readonly<Record<string, unknown>>;
  readonly tenantId: string;
  readonly userId?: string | null;
}

/** Template imutável de um workflow. */
export interface BellaWorkflowDefinition {
  readonly workflowId: string;
  readonly name: string;
  readonly description: string;
  readonly steps: readonly BellaWorkflowStep[];
}

/** Log estruturado — nunca renderizado ao usuário. */
export type BellaWorkflowLogEvent =
  | "workflow_started"
  | "step_started"
  | "step_completed"
  | "step_waiting_user"
  | "step_failed"
  | "step_cancelled"
  | "workflow_completed"
  | "workflow_failed"
  | "workflow_cancelled"
  | "workflow_resumed";

export interface BellaWorkflowLogEntry {
  readonly event: BellaWorkflowLogEvent;
  readonly workflowId: string;
  readonly instanceId: string;
  readonly stepId?: string;
  readonly stepIndex?: number;
  readonly at: number;
  readonly detail?: string;
}

/** Histórico de execução de cada Step. */
export interface BellaWorkflowStepHistoryEntry {
  readonly stepId: string;
  readonly stepIndex: number;
  readonly status: "completed" | "failed" | "cancelled" | "waiting_user";
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly outputs?: Record<string, unknown>;
  readonly error?: string;
  readonly skillResultCode?: string;
}

/** Instância viva de um workflow — persistida na Bella Memory. */
export interface BellaWorkflowInstance {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string | null;
  readonly workflowId: string;
  readonly name: string;
  readonly description: string;

  currentStep: number; // 0-based index do próximo Step a executar
  readonly totalSteps: number;
  status: BellaWorkflowStatus;
  progress: number; // 0..100

  collectedParameters: Record<string, unknown>;
  stepOutputs: Record<string, unknown>;
  history: BellaWorkflowStepHistoryEntry[];

  lastError: string | null;
  lastMessage: string | null;

  readonly createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
}

/** Snapshot leve para exibição/telemetria. */
export interface BellaWorkflowProgress {
  readonly instanceId: string;
  readonly workflowId: string;
  readonly name: string;
  readonly status: BellaWorkflowStatus;
  readonly currentStep: number;
  readonly totalSteps: number;
  readonly progress: number;
  readonly currentStepName: string | null;
  readonly nextStepName: string | null;
  readonly previousStepName: string | null;
  readonly lastMessage: string | null;
  readonly lastError: string | null;
}

/** Resultado das operações do Engine (start/resume/step). */
export interface BellaWorkflowExecutionResult {
  readonly ok: boolean;
  readonly instance: BellaWorkflowInstance;
  readonly progress: BellaWorkflowProgress;
  readonly stepResult?: BellaSkillResult;
  readonly message: string;
}
