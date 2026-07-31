/**
 * BellaWorkflowContext — contexto de execução compartilhado entre
 * Engine, Executor e Steps. Não carrega regra de negócio.
 */

import type { BellaMemoryManager } from "../memory/BellaMemoryManager";
import { bellaMemoryManager } from "../memory/BellaMemoryManager";
import { BellaSkillRegistry } from "../skills/registry";

export interface BellaWorkflowContext {
  readonly tenantId: string;
  readonly userId: string | null;
  readonly memory: BellaMemoryManager;
  readonly skills: typeof BellaSkillRegistry;
}

export function createWorkflowContext(params: {
  tenantId: string;
  userId?: string | null;
  memory?: BellaMemoryManager;
}): BellaWorkflowContext {
  return {
    tenantId: params.tenantId,
    userId: params.userId ?? null,
    memory: params.memory ?? bellaMemoryManager,
    skills: BellaSkillRegistry,
  };
}
