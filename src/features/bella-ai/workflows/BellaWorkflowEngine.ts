/**
 * BellaWorkflowEngine — orquestra o ciclo de vida do Workflow:
 *  - start(): valida template, cria instância, persiste em memória.
 *  - resume(): retoma exatamente de onde parou (WAITING_USER ou FAILED).
 *  - cancel(): interrompe a instância ativa preservando histórico.
 *  - progress(): snapshot leve para a UI/chat.
 *
 * Regras invioláveis:
 *  - Não altera Services.
 *  - Não altera Providers.
 *  - Não duplica regra de negócio — sempre delega à Skill via Registry.
 *  - Não decide sozinho: confirmação sempre parte do usuário.
 */

import { bellaMemoryManager, type BellaMemoryManager } from "../memory/BellaMemoryManager";
import { createInstance } from "./BellaWorkflow";
import { createWorkflowContext, type BellaWorkflowContext } from "./BellaWorkflowContext";
import { BellaWorkflowExecutor } from "./BellaWorkflowExecutor";
import { BellaWorkflowRegistry } from "./BellaWorkflowRegistry";
import { buildProgress, canRun, transition } from "./BellaWorkflowState";
import type {
  BellaWorkflowDefinition,
  BellaWorkflowExecutionResult,
  BellaWorkflowInstance,
  BellaWorkflowLogEntry,
  BellaWorkflowLogEvent,
  BellaWorkflowProgress,
} from "./BellaWorkflowTypes";

type InstanceKey = `${string}::${string}`;

const WORKFLOW_MEMORY_KEY = "__bella_workflow__";

interface StoredInstance {
  instance: BellaWorkflowInstance;
  definition: BellaWorkflowDefinition;
}

export class BellaWorkflowEngine {
  private instances = new Map<InstanceKey, StoredInstance>();
  private logs: BellaWorkflowLogEntry[] = [];
  private maxLogs = 500;

  constructor(
    private readonly memory: BellaMemoryManager = bellaMemoryManager,
    private readonly registry: typeof BellaWorkflowRegistry = BellaWorkflowRegistry,
    private readonly executor: BellaWorkflowExecutor = new BellaWorkflowExecutor(),
  ) {
    // Reencaminha logs do Executor para o Engine.
    (this.executor as unknown as { hooks: { onLog?: (e: string, d?: string) => void } }).hooks = {
      onLog: (event, detail) => {
        const active = this.pickAnyActive();
        this.log(event as BellaWorkflowLogEvent, active?.instance, detail);
      },
    };
  }

  private key(tenantId: string, userId: string | null | undefined): InstanceKey {
    return `${tenantId}::${userId ?? "_"}` as InstanceKey;
  }

  private pickAnyActive(): StoredInstance | undefined {
    return this.instances.values().next().value;
  }

  private log(
    event: BellaWorkflowLogEvent,
    instance?: BellaWorkflowInstance,
    detail?: string,
  ): void {
    if (!instance) return;
    this.logs.push({
      event,
      workflowId: instance.workflowId,
      instanceId: instance.id,
      stepIndex: instance.currentStep,
      at: Date.now(),
      detail,
    });
    if (this.logs.length > this.maxLogs) {
      this.logs.splice(0, this.logs.length - this.maxLogs);
    }
  }

  private buildContext(
    tenantId: string,
    userId: string | null | undefined,
  ): BellaWorkflowContext {
    return createWorkflowContext({ tenantId, userId, memory: this.memory });
  }

  /** Sincroniza um resumo do workflow ativo com a Bella Memory. */
  private syncMemory(instance: BellaWorkflowInstance): void {
    if (!instance.userId) return;
    this.memory.update(instance.tenantId, instance.userId, {
      currentGoal: instance.name,
      activeSkill: null,
      activeConversationState:
        instance.status === "WAITING_USER"
          ? "awaiting_confirmation"
          : instance.status === "RUNNING" || instance.status === "PENDING"
            ? "executing"
            : instance.status === "COMPLETED"
              ? "completed"
              : instance.status === "CANCELLED"
                ? "cancelled"
                : "idle",
      collectedParameters: {
        ...instance.collectedParameters,
        [WORKFLOW_MEMORY_KEY]: {
          instanceId: instance.id,
          workflowId: instance.workflowId,
          currentStep: instance.currentStep,
          totalSteps: instance.totalSteps,
          status: instance.status,
          progress: instance.progress,
        },
      },
      lastAction: `workflow:${instance.workflowId}`,
      lastResponse: instance.lastMessage,
    });
  }

  // ───────────────────────── API pública ─────────────────────────

  /** Inicia um Workflow a partir do template. Não executa nenhum Step ainda. */
  start(params: {
    workflowId: string;
    tenantId: string;
    userId?: string | null;
    initialParameters?: Record<string, unknown>;
  }): BellaWorkflowExecutionResult {
    const definition = this.registry.get(params.workflowId);
    if (!definition) {
      throw new Error(`Workflow "${params.workflowId}" não registrado.`);
    }
    const instance = createInstance({
      definition,
      tenantId: params.tenantId,
      userId: params.userId,
      initialParameters: params.initialParameters,
    });
    this.instances.set(this.key(params.tenantId, params.userId), {
      instance,
      definition,
    });
    this.log("workflow_started", instance);
    this.syncMemory(instance);
    return {
      ok: true,
      instance,
      progress: buildProgress(instance, definition),
      message: `Workflow "${definition.name}" iniciado. Etapa 1 de ${definition.steps.length}.`,
    };
  }

  /**
   * Executa o Step atual. Se estiver WAITING_USER ou FAILED, é preciso
   * chamar `resume()` — nunca reiniciamos automaticamente.
   */
  async runNextStep(params: {
    tenantId: string;
    userId?: string | null;
    confirmed?: boolean;
    additionalParameters?: Record<string, unknown>;
  }): Promise<BellaWorkflowExecutionResult> {
    const stored = this.requireInstance(params.tenantId, params.userId);
    const { instance, definition } = stored;

    if (!canRun(instance.status)) {
      return {
        ok: false,
        instance,
        progress: buildProgress(instance, definition),
        message: `Workflow no status ${instance.status} não pode avançar.`,
      };
    }

    if (params.additionalParameters) {
      instance.collectedParameters = {
        ...instance.collectedParameters,
        ...params.additionalParameters,
      };
    }

    const result = await this.executor.runStep({
      definition,
      instance,
      context: this.buildContext(params.tenantId, params.userId),
      confirmed: params.confirmed,
    });
    this.syncMemory(instance);
    return result;
  }

  /**
   * Retoma um Workflow interrompido (WAITING_USER ou FAILED).
   * Nunca reinicia — retoma exatamente do Step atual.
   */
  async resume(params: {
    tenantId: string;
    userId?: string | null;
    confirmed?: boolean;
    additionalParameters?: Record<string, unknown>;
  }): Promise<BellaWorkflowExecutionResult> {
    const stored = this.requireInstance(params.tenantId, params.userId);
    const { instance, definition } = stored;

    if (instance.status === "COMPLETED" || instance.status === "CANCELLED") {
      return {
        ok: false,
        instance,
        progress: buildProgress(instance, definition),
        message: `Workflow já finalizado (${instance.status}). Não é possível retomar.`,
      };
    }

    if (instance.status === "FAILED") {
      // Retorna ao ponto de falha sem repetir Steps anteriores.
      transition(instance, "RUNNING");
      instance.lastError = null;
      this.log("workflow_resumed", instance);
    } else if (instance.status === "WAITING_USER") {
      this.log("workflow_resumed", instance);
    }

    return this.runNextStep({
      tenantId: params.tenantId,
      userId: params.userId,
      confirmed: params.confirmed,
      additionalParameters: params.additionalParameters,
    });
  }

  /** Cancela o Workflow ativo. Preserva histórico. */
  cancel(params: {
    tenantId: string;
    userId?: string | null;
    reason?: string;
  }): BellaWorkflowExecutionResult {
    const stored = this.requireInstance(params.tenantId, params.userId);
    const { instance, definition } = stored;
    transition(instance, "CANCELLED");
    instance.lastMessage = params.reason ?? "Workflow cancelado.";
    this.log("workflow_cancelled", instance, params.reason);
    this.syncMemory(instance);
    return {
      ok: true,
      instance,
      progress: buildProgress(instance, definition),
      message: instance.lastMessage,
    };
  }

  /** Snapshot de progresso — seguro para exibir na UI/chat. */
  progress(params: {
    tenantId: string;
    userId?: string | null;
  }): BellaWorkflowProgress | null {
    const stored = this.instances.get(this.key(params.tenantId, params.userId));
    if (!stored) return null;
    return buildProgress(stored.instance, stored.definition);
  }

  /** Retorna a instância ativa (leitura). */
  peek(params: {
    tenantId: string;
    userId?: string | null;
  }): BellaWorkflowInstance | null {
    return this.instances.get(this.key(params.tenantId, params.userId))?.instance ?? null;
  }

  /** Descarta a instância — usado após COMPLETED/CANCELLED se quiser liberar. */
  discard(params: { tenantId: string; userId?: string | null }): void {
    this.instances.delete(this.key(params.tenantId, params.userId));
  }

  getLogs(): readonly BellaWorkflowLogEntry[] {
    return this.logs;
  }

  /** Somente para testes. */
  __clearAll(): void {
    this.instances.clear();
    this.logs = [];
  }

  private requireInstance(
    tenantId: string,
    userId: string | null | undefined,
  ): StoredInstance {
    const stored = this.instances.get(this.key(tenantId, userId));
    if (!stored) {
      throw new Error("Nenhum Workflow ativo para este contexto (tenant/user).");
    }
    return stored;
  }
}

/** Singleton compartilhado. */
export const bellaWorkflowEngine = new BellaWorkflowEngine();
