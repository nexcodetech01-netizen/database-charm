/**
 * BellaWorkflowRegistry — armazena templates de workflows.
 * Análogo ao BellaSkillRegistry: ponto único de registro/consulta.
 *
 * A validação estrutural (Skill existente etc.) roda no `register()` —
 * um template inválido nunca entra no Registry.
 */

import type { BellaWorkflowDefinition } from "./BellaWorkflowTypes";
import { validateDefinition } from "./BellaWorkflowValidator";

class BellaWorkflowRegistryImpl {
  private workflows = new Map<string, BellaWorkflowDefinition>();

  register(def: BellaWorkflowDefinition): void {
    // No cliente, não temos acesso ao BellaSkillRegistry para validar. 
    // No servidor, carregamos dinamicamente para validar.
    let validation = { ok: true, errors: [] as string[] };
    if (typeof window === 'undefined') {
      try {
        const { BellaSkillRegistry } = await import("../skills/registry" + "");
        validation = validateDefinition(def, BellaSkillRegistry);
      } catch (err) {
        console.warn("[BellaWorkflowRegistry] Skipped server-side validation:", err);
      }
    }

    if (!validation.ok) {
      throw new Error(
        `[BellaWorkflowRegistry] "${def.workflowId}" inválido: ${validation.errors.join("; ")}`,
      );
    }
    this.workflows.set(def.workflowId, def);
  }

  registerAll(defs: BellaWorkflowDefinition[]): void {
    for (const d of defs) this.register(d);
  }

  get(id: string): BellaWorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  has(id: string): boolean {
    return this.workflows.has(id);
  }

  list(): BellaWorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  /** Somente para testes. */
  __clearAll(): void {
    this.workflows.clear();
  }
}

export const BellaWorkflowRegistry = new BellaWorkflowRegistryImpl();
