/**
 * BellaSkillRegistry
 *
 * Ponto único de registro/execução de Skills. Nenhum consumidor
 * (engine, handler, futuro LLM) acessa Skills diretamente — tudo
 * passa por aqui, permitindo evoluir cada módulo isoladamente.
 */

import type {
  BellaSkill,
  BellaSkillContext,
  BellaSkillPayload,
  BellaSkillResult,
} from "./types";
import { skillResult } from "./types";
import type { BellaModuleKey } from "../providers/modules/base";

class BellaSkillRegistryImpl {
  private skills = new Map<string, BellaSkill>();

  register<TPayload, TData>(skill: BellaSkill<TPayload, TData>): void {
    // Cast necessário: o Map guarda o tipo genérico apagado; a
    // Skill valida o payload no seu próprio execute().
    this.skills.set(skill.id, skill as unknown as BellaSkill);
  }

  registerAll(skills: BellaSkill<unknown, unknown>[]): void {
    for (const s of skills) this.register(s as unknown as BellaSkill);
  }

  get(id: string): BellaSkill | undefined {
    return this.skills.get(id);
  }

  has(id: string): boolean {
    return this.skills.has(id);
  }

  list(): BellaSkill[] {
    return Array.from(this.skills.values());
  }

  listByModule(module: BellaModuleKey): BellaSkill[] {
    return this.list().filter((s) => s.module === module);
  }

  async execute(
    id: string,
    payload: BellaSkillPayload,
    ctx: BellaSkillContext,
  ): Promise<BellaSkillResult> {
    const skill = this.get(id);
    if (!skill) {
      return skillResult.unavailable(
        `Skill "${id}" não encontrada. Verifique se o módulo está disponível.`,
      );
    }
    if (!skill.canExecute(ctx)) {
      return skillResult.notAllowed(
        `Você não tem permissão para executar "${skill.name}" agora.`,
      );
    }
    try {
      return await skill.execute(payload, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha inesperada ao executar a Skill.";
      return skillResult.error(message);
    }
  }
}

export const BellaSkillRegistry = new BellaSkillRegistryImpl();
export type { BellaSkill } from "./types";
