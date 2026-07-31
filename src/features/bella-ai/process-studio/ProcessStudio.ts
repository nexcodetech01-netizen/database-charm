/**
 * ProcessStudio — Facade do módulo.
 *
 * Orquestra Builder + Validator + Compiler + Versioning + Simulator +
 * publicação no BellaWorkflowRegistry. NÃO cria motor paralelo: a
 * publicação registra a `BellaWorkflowDefinition` compilada no engine
 * existente. Storage in-memory por empresa (mesmo padrão dos Registries
 * atuais da Bella).
 */
import { compileFlow } from "./FlowCompiler";
import { simulateFlow } from "./FlowSimulator";
import { validateFlow } from "./FlowValidator";
import { FlowVersionStore } from "./FlowVersioning";
import { createFlow, withMeta, withNodes } from "./FlowBuilder";
import { BellaWorkflowRegistry } from "../workflows/BellaWorkflowRegistry";
import type {
  FlowDefinition,
  FlowLogEntry,
  FlowLogEvent,
  FlowNode,
  FlowSimulationResult,
  FlowValidationResult,
} from "./types";

interface FlowsByCompany {
  readonly companyId: string;
  readonly flows: Map<string, FlowDefinition>;
}

class ProcessStudioImpl {
  private readonly byCompany = new Map<string, FlowsByCompany>();
  private readonly versions = new FlowVersionStore();
  private readonly logs: FlowLogEntry[] = [];
  private readonly maxLogs = 1000;

  private bucket(companyId: string): FlowsByCompany {
    let b = this.byCompany.get(companyId);
    if (!b) {
      b = { companyId, flows: new Map() };
      this.byCompany.set(companyId, b);
    }
    return b;
  }

  private log(event: FlowLogEvent, flow: FlowDefinition, actorId: string | null, detail?: string) {
    this.logs.push({
      at: Date.now(),
      event,
      flowId: flow.id,
      version: flow.version,
      actorId,
      detail,
    });
    if (this.logs.length > this.maxLogs) this.logs.shift();
  }

  list(companyId: string): FlowDefinition[] {
    return Array.from(this.bucket(companyId).flows.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }

  get(companyId: string, flowId: string): FlowDefinition | undefined {
    return this.bucket(companyId).flows.get(flowId);
  }

  create(input: {
    companyId: string;
    name: string;
    description?: string;
    authorId?: string | null;
    nodes?: readonly FlowNode[];
    tags?: readonly string[];
  }): FlowDefinition {
    const flow = createFlow(input);
    this.bucket(flow.companyId).flows.set(flow.id, flow);
    this.versions.snapshot(flow, "criação");
    this.log("flow_created", flow, input.authorId ?? null);
    return flow;
  }

  update(
    companyId: string,
    flowId: string,
    patch: {
      name?: string;
      description?: string;
      nodes?: readonly FlowNode[];
      tags?: readonly string[];
      actorId?: string | null;
    },
  ): FlowDefinition {
    const cur = this.mustGet(companyId, flowId);
    let next = cur;
    if (patch.name || patch.description || patch.tags) {
      next = withMeta(next, {
        name: patch.name,
        description: patch.description,
        tags: patch.tags,
      });
    }
    if (patch.nodes) {
      next = withNodes(next, patch.nodes);
    }
    // edições em rascunho não bumpam versão; publicar/rollback fazem isso.
    if (next.status !== "draft") {
      next = { ...next, status: "draft" };
    }
    this.bucket(companyId).flows.set(flowId, next);
    this.log("flow_edited", next, patch.actorId ?? null);
    return next;
  }

  validate(companyId: string, flowId: string): FlowValidationResult {
    const flow = this.mustGet(companyId, flowId);
    const res = validateFlow(flow);
    this.log("flow_validated", flow, null, res.ok ? "ok" : `${res.issues.length} issues`);
    return res;
  }

  simulate(companyId: string, flowId: string): FlowSimulationResult {
    const flow = this.mustGet(companyId, flowId);
    const res = simulateFlow(flow);
    this.log("flow_simulated", flow, null, `${res.steps.length} passos`);
    return res;
  }

  publish(
    companyId: string,
    flowId: string,
    actorId: string | null,
  ): { flow: FlowDefinition; workflowId: string; skippedNodes: readonly string[] } {
    const cur = this.mustGet(companyId, flowId);
    const validation = validateFlow(cur);
    if (!validation.ok) {
      throw new Error(
        `Fluxo inválido: ${validation.issues.map((i) => i.message).join("; ")}`,
      );
    }
    const bumped: FlowDefinition = {
      ...cur,
      status: "published",
      version: cur.version + 1,
      updatedAt: Date.now(),
    };
    const compiled = compileFlow(bumped);
    // Registra no Workflow Engine existente. Se já houver definição com
    // o mesmo workflowId (versão), sobrescreve — como qualquer novo build.
    try {
      BellaWorkflowRegistry.register(compiled.definition);
    } catch (err) {
      throw new Error(
        `Falha ao registrar workflow: ${err instanceof Error ? err.message : "erro"}`,
      );
    }
    this.bucket(companyId).flows.set(flowId, bumped);
    this.versions.snapshot(bumped, "publicação");
    this.log("flow_published", bumped, actorId, compiled.definition.workflowId);
    return {
      flow: bumped,
      workflowId: compiled.definition.workflowId,
      skippedNodes: compiled.skippedNodes,
    };
  }

  archive(companyId: string, flowId: string, actorId: string | null): FlowDefinition {
    const cur = this.mustGet(companyId, flowId);
    const next: FlowDefinition = { ...cur, status: "archived", updatedAt: Date.now() };
    this.bucket(companyId).flows.set(flowId, next);
    this.log("flow_archived", next, actorId);
    return next;
  }

  listVersions(companyId: string, flowId: string) {
    const flow = this.mustGet(companyId, flowId);
    return this.versions.list(flow.id);
  }

  rollback(
    companyId: string,
    flowId: string,
    targetVersion: number,
    actorId: string | null,
  ): FlowDefinition {
    const cur = this.mustGet(companyId, flowId);
    const next = this.versions.rollback(cur, targetVersion);
    this.bucket(companyId).flows.set(flowId, { ...next, status: "draft" });
    this.versions.snapshot(next, `rollback→v${targetVersion}`);
    this.log("flow_rolled_back", next, actorId, `→v${targetVersion}`);
    return next;
  }

  listLogs(companyId: string, flowId?: string): readonly FlowLogEntry[] {
    const ids = new Set(this.bucket(companyId).flows.keys());
    return this.logs.filter(
      (l) => ids.has(l.flowId) && (!flowId || l.flowId === flowId),
    );
  }

  stats(companyId: string) {
    const flows = this.list(companyId);
    const logs = this.listLogs(companyId);
    return {
      active: flows.filter((f) => f.status === "published").length,
      drafts: flows.filter((f) => f.status === "draft").length,
      archived: flows.filter((f) => f.status === "archived").length,
      total: flows.length,
      recentFailures: logs.filter((l) => l.event === "flow_failed").slice(-5),
      mostExecuted: logs
        .filter((l) => l.event === "flow_executed")
        .reduce<Record<string, number>>((acc, l) => {
          acc[l.flowId] = (acc[l.flowId] ?? 0) + 1;
          return acc;
        }, {}),
    };
  }

  private mustGet(companyId: string, flowId: string): FlowDefinition {
    const f = this.get(companyId, flowId);
    if (!f) throw new Error(`Fluxo ${flowId} não encontrado.`);
    return f;
  }

  /** Somente testes. */
  __clearAll(): void {
    this.byCompany.clear();
    this.versions.__clear();
    this.logs.length = 0;
  }
}

export const ProcessStudio = new ProcessStudioImpl();
export type ProcessStudioInstance = typeof ProcessStudio;
