/**
 * BellaWorkflowState — helpers puros para transição de status
 * e cálculo de progresso. Sem side-effects, sem I/O.
 */

import type {
  BellaWorkflowDefinition,
  BellaWorkflowInstance,
  BellaWorkflowProgress,
  BellaWorkflowStatus,
} from "./BellaWorkflowTypes";

const FINAL_STATUSES: readonly BellaWorkflowStatus[] = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export function isFinalStatus(status: BellaWorkflowStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

export function canRun(status: BellaWorkflowStatus): boolean {
  return status === "PENDING" || status === "WAITING_USER" || status === "RUNNING";
}

export function computeProgressPercent(current: number, total: number): number {
  if (total <= 0) return 0;
  const pct = Math.round((current / total) * 100);
  if (pct < 0) return 0;
  if (pct > 100) return 100;
  return pct;
}

export function buildProgress(
  instance: BellaWorkflowInstance,
  definition: BellaWorkflowDefinition,
): BellaWorkflowProgress {
  const total = definition.steps.length;
  const idx = instance.currentStep;
  const currentStep = idx >= 0 && idx < total ? definition.steps[idx] : null;
  const nextStep =
    idx + 1 >= 0 && idx + 1 < total ? definition.steps[idx + 1] : null;
  const prevStep = idx - 1 >= 0 && idx - 1 < total ? definition.steps[idx - 1] : null;
  return {
    instanceId: instance.id,
    workflowId: instance.workflowId,
    name: instance.name,
    status: instance.status,
    currentStep: Math.min(idx + 1, total),
    totalSteps: total,
    progress: instance.progress,
    currentStepName: currentStep?.name ?? null,
    nextStepName: nextStep?.name ?? null,
    previousStepName: prevStep?.name ?? null,
    lastMessage: instance.lastMessage,
    lastError: instance.lastError,
  };
}

export function transition(
  instance: BellaWorkflowInstance,
  next: BellaWorkflowStatus,
): void {
  instance.status = next;
  instance.updatedAt = Date.now();
  if (isFinalStatus(next) && instance.finishedAt === null) {
    instance.finishedAt = instance.updatedAt;
  }
}
