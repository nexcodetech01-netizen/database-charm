/**
 * Bella Process Studio — Types
 *
 * Um "Flow" é a representação declarativa de um processo desenhado
 * visualmente. Ele NÃO é executado diretamente: o FlowCompiler o
 * traduz para uma `BellaWorkflowDefinition` executada pelo
 * BellaWorkflowEngine já existente. Isso garante que:
 *   - não há motor paralelo;
 *   - Services / Providers / Skills / Action Engine permanecem intocados;
 *   - qualquer efeito real ocorre via Skills registradas.
 */

export type FlowNodeKind =
  | "start"
  | "end"
  | "event"
  | "condition"
  | "if"
  | "else"
  | "loop"
  | "delay"
  | "webhook"
  | "whatsapp"
  | "skill"
  | "workflow"
  | "automation"
  | "approval"
  | "decision"
  | "humanTask"
  | "question"
  | "confirmation"
  | "notification";

export type FlowStatus = "draft" | "test" | "published" | "archived";

export type FlowPermission = "view" | "edit" | "publish" | "execute";

export interface FlowNode {
  readonly id: string;
  readonly kind: FlowNodeKind;
  readonly label: string;
  /**
   * Configuração declarativa e serializável. Interpretada pelo
   * compilador / simulador conforme o `kind`.
   */
  readonly config: Record<string, unknown>;
}

export interface FlowDefinition {
  readonly id: string;
  readonly companyId: string;
  readonly name: string;
  readonly description: string;
  readonly status: FlowStatus;
  readonly version: number;
  readonly nodes: readonly FlowNode[];
  readonly tags: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly authorId: string | null;
}

export interface FlowVersionEntry {
  readonly version: number;
  readonly authorId: string | null;
  readonly createdAt: number;
  readonly nodes: readonly FlowNode[];
  readonly name: string;
  readonly description: string;
  readonly note?: string;
}

export interface FlowValidationIssue {
  readonly nodeId?: string;
  readonly code:
    | "missing_start"
    | "missing_end"
    | "orphan_node"
    | "invalid_skill"
    | "invalid_config"
    | "duplicate_id"
    | "empty_flow";
  readonly message: string;
}

export interface FlowValidationResult {
  readonly ok: boolean;
  readonly issues: readonly FlowValidationIssue[];
}

export interface FlowSimulationStep {
  readonly nodeId: string;
  readonly kind: FlowNodeKind;
  readonly label: string;
  readonly action: string;
  readonly estimatedMs: number;
  readonly skillId?: string;
  readonly note?: string;
}

export interface FlowSimulationResult {
  readonly flowId: string;
  readonly ok: boolean;
  readonly steps: readonly FlowSimulationStep[];
  readonly totalEstimatedMs: number;
  readonly warnings: readonly string[];
}

export type FlowLogEvent =
  | "flow_created"
  | "flow_edited"
  | "flow_validated"
  | "flow_simulated"
  | "flow_published"
  | "flow_archived"
  | "flow_rolled_back"
  | "flow_executed"
  | "flow_failed";

export interface FlowLogEntry {
  readonly at: number;
  readonly event: FlowLogEvent;
  readonly flowId: string;
  readonly version?: number;
  readonly actorId: string | null;
  readonly detail?: string;
}
