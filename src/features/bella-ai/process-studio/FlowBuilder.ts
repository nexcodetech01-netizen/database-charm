/**
 * FlowBuilder — API declarativa e imutável para montar Flows a partir
 * de código, testes ou templates. Não executa nada — apenas retorna
 * `FlowDefinition` normalizado.
 */
import type { FlowDefinition, FlowNode, FlowNodeKind } from "./types";

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function createNode(
  kind: FlowNodeKind,
  label: string,
  config: Record<string, unknown> = {},
): FlowNode {
  return { id: nextId(`n_${kind}`), kind, label, config };
}

export interface CreateFlowInput {
  companyId: string;
  name: string;
  description?: string;
  authorId?: string | null;
  nodes?: readonly FlowNode[];
  tags?: readonly string[];
}

export function createFlow(input: CreateFlowInput): FlowDefinition {
  const now = Date.now();
  const nodes =
    input.nodes && input.nodes.length > 0
      ? input.nodes
      : [createNode("start", "Início"), createNode("end", "Fim")];
  return {
    id: nextId("flow"),
    companyId: input.companyId,
    name: input.name.trim(),
    description: (input.description ?? "").trim(),
    status: "draft",
    version: 1,
    nodes,
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
    authorId: input.authorId ?? null,
  };
}

export function withNodes(flow: FlowDefinition, nodes: readonly FlowNode[]): FlowDefinition {
  return { ...flow, nodes, updatedAt: Date.now() };
}

export function withMeta(
  flow: FlowDefinition,
  patch: Partial<Pick<FlowDefinition, "name" | "description" | "tags">>,
): FlowDefinition {
  return {
    ...flow,
    name: patch.name?.trim() ?? flow.name,
    description: patch.description?.trim() ?? flow.description,
    tags: patch.tags ?? flow.tags,
    updatedAt: Date.now(),
  };
}
