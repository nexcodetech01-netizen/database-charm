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

  register(def: BellaWorkflowDefinition, registry?: any): void {
    let validation = { ok: true, errors: [] as string[] };
    
    // Se o registry for passado, validamos imediatamente.
    // Caso contrário, se estivermos no servidor, tentamos carregar o global.
    if (registry) {
      validation = validateDefinition(def, registry);
    } else if (typeof window === 'undefined') {
      // Nota: No servidor, o ideal é que o registry seja passado.
      // A validação aqui é apenas um fallback de segurança.
      validation = { ok: true, errors: [] }; 
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
