import type { BellaWorkflowDefinition } from "./BellaWorkflowTypes";
import { validateDefinition } from "./BellaWorkflowValidator";

class BellaWorkflowRegistryImpl {
  private workflows = new Map<string, BellaWorkflowDefinition>();

  /**
   * Registra um workflow. 
   * A validação estrutural é feita via injeção de dependência do SkillRegistry.
   */
  register(def: BellaWorkflowDefinition, registry?: any): void {
    if (registry) {
      const validation = validateDefinition(def, registry);
      if (!validation.ok) {
        throw new Error(
          `[BellaWorkflowRegistry] "${def.workflowId}" inválido: ${validation.errors.join("; ")}`,
        );
      }
    }
    this.workflows.set(def.workflowId, def);
  }

  registerAll(defs: BellaWorkflowDefinition[], registry?: any): void {
    for (const d of defs) this.register(d, registry);
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

  __clearAll(): void {
    this.workflows.clear();
  }
}

export const BellaWorkflowRegistry = new BellaWorkflowRegistryImpl();
