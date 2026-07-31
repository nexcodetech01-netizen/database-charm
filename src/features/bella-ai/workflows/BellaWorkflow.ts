/**
 * BellaWorkflow — fábrica de instâncias e helpers de construção
 * declarativa de definições. Zero regra de negócio.
 */

import type {
  BellaWorkflowDefinition,
  BellaWorkflowInstance,
  BellaWorkflowStep,
} from "./BellaWorkflowTypes";

let counter = 0;
function nextInstanceId(): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `wf_${Date.now().toString(36)}_${counter}_${rand}`;
}

export function defineWorkflow(input: {
  workflowId: string;
  name: string;
  description: string;
  steps: readonly BellaWorkflowStep[];
}): BellaWorkflowDefinition {
  return Object.freeze({
    workflowId: input.workflowId,
    name: input.name,
    description: input.description,
    steps: [...input.steps],
  });
}

export function createInstance(params: {
  definition: BellaWorkflowDefinition;
  tenantId: string;
  userId?: string | null;
  initialParameters?: Record<string, unknown>;
}): BellaWorkflowInstance {
  const now = Date.now();
  return {
    id: nextInstanceId(),
    tenantId: params.tenantId,
    userId: params.userId ?? null,
    workflowId: params.definition.workflowId,
    name: params.definition.name,
    description: params.definition.description,
    currentStep: 0,
    totalSteps: params.definition.steps.length,
    status: "PENDING",
    progress: 0,
    collectedParameters: { ...(params.initialParameters ?? {}) },
    stepOutputs: {},
    history: [],
    lastError: null,
    lastMessage: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
  };
}
