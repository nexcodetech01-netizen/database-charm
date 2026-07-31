/**
 * FlowVersioning — mantém o histórico de versões de cada Flow.
 *
 * O storage é in-memory por padrão (mesmo padrão dos demais Registries
 * da Bella). A camada server-side reaproveita esta classe.
 */
import type { FlowDefinition, FlowVersionEntry } from "./types";

export class FlowVersionStore {
  private readonly versions = new Map<string, FlowVersionEntry[]>();

  snapshot(flow: FlowDefinition, note?: string): FlowVersionEntry {
    const entry: FlowVersionEntry = {
      version: flow.version,
      authorId: flow.authorId,
      createdAt: Date.now(),
      nodes: flow.nodes.map((n) => ({ ...n, config: { ...n.config } })),
      name: flow.name,
      description: flow.description,
      note,
    };
    const bucket = this.versions.get(flow.id) ?? [];
    // evita duplicar snapshot da mesma versão
    if (!bucket.some((v) => v.version === entry.version)) {
      bucket.push(entry);
      this.versions.set(flow.id, bucket);
    }
    return entry;
  }

  list(flowId: string): readonly FlowVersionEntry[] {
    return this.versions.get(flowId) ?? [];
  }

  get(flowId: string, version: number): FlowVersionEntry | undefined {
    return this.versions.get(flowId)?.find((v) => v.version === version);
  }

  /**
   * Retorna a definição resultante de aplicar rollback para uma versão
   * anterior — a nova versão é `flow.version + 1` para manter histórico
   * linear e auditável.
   */
  rollback(flow: FlowDefinition, targetVersion: number): FlowDefinition {
    const target = this.get(flow.id, targetVersion);
    if (!target) throw new Error(`Versão ${targetVersion} não encontrada.`);
    return {
      ...flow,
      version: flow.version + 1,
      nodes: target.nodes.map((n) => ({ ...n, config: { ...n.config } })),
      updatedAt: Date.now(),
    };
  }

  __clear(): void {
    this.versions.clear();
  }
}
