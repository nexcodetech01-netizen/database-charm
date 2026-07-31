/**
 * FlowSerializer — snapshot JSON estável de um FlowDefinition.
 * Puro. Não interage com storage — apenas produz strings/objetos.
 */
import type { FlowDefinition, FlowNode } from "./types";

export interface SerializedFlow {
  readonly schema: "bella.process-studio.flow";
  readonly schemaVersion: 1;
  readonly flow: FlowDefinition;
}

export function serializeFlow(flow: FlowDefinition): SerializedFlow {
  return { schema: "bella.process-studio.flow", schemaVersion: 1, flow };
}

export function toJSON(flow: FlowDefinition): string {
  return JSON.stringify(serializeFlow(flow), null, 2);
}

export function fromJSON(raw: string): FlowDefinition {
  const parsed = JSON.parse(raw) as SerializedFlow;
  if (parsed?.schema !== "bella.process-studio.flow") {
    throw new Error("Formato de fluxo inválido.");
  }
  return normalize(parsed.flow);
}

function normalize(flow: FlowDefinition): FlowDefinition {
  const nodes: FlowNode[] = (flow.nodes ?? []).map((n) => ({
    id: String(n.id),
    kind: n.kind,
    label: String(n.label ?? ""),
    config: { ...(n.config ?? {}) },
  }));
  return { ...flow, nodes };
}
