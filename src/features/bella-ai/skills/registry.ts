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
  private initialized = false;

  register<TPayload, TData>(skill: BellaSkill<TPayload, TData>): void {
    
    // Registro idempotente: evita duplicados no Singleton
    if (this.skills.has(skill.id)) return;
    
    // Cast necessário: o Map guarda o tipo genérico apagado; a
    // Skill valida o payload no seu próprio execute().
    this.skills.set(skill.id, skill as unknown as BellaSkill);
  }

  registerAll(skills: BellaSkill<unknown, unknown>[]): void {
    for (const s of skills) this.register(s as unknown as BellaSkill);
  }

  /**
   * Inicializa o Registry com todas as skills do sistema.
   * Chamado explicitamente no bootstrap do Agente para evitar 
   * falhas por dependência circular em imports implícitos.
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    
    // CORREÇÃO CIRÚRGICA: O import dinâmico estático 'await import("./index")' 
    // estava sendo rastreado pelo Vite no bundle do cliente, vazando 
    // dependências de servidor. Agora usamos um helper .server.ts que 
    // é opaco para o bundle do cliente.
    try {
      const { initializeRegistryOnServer } = await import("./registry.server");
      await initializeRegistryOnServer();
      this.initialized = true;
    } catch (err) {
      console.warn("[BellaSkillRegistry] Could not initialize server skills:", err);
    }
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
    confirmed?: boolean,
  ): Promise<BellaSkillResult> {
    const skill = this.skills.get(id);
    if (!skill) {
      return skillResult.unavailable(`Skill "${id}" não encontrada.`);
    }

    try {
      // Se a skill for uma BaseSkill (v2), usamos o método run que gerencia o pipeline
      if ("run" in skill && typeof (skill as any).run === "function") {
        // Build basic ExecutionContext for BaseSkill
        const { buildExecutionContext } = await import("../agent/infrastructure/context");
        const execCtx = buildExecutionContext({
          companyId: ctx.companyId,
          userId: ctx.userId ?? null,
          permissions: new Set(["*"]), // Fallback permissions, real check inside run
          isOwner: true,
          channel: "web",
        });

        return await (skill as any).run({
          payload,
          ctx: execCtx,
          confirmed,
        });
      }

      // Legado
      if (!skill.canExecute(ctx)) {
        return skillResult.notAllowed(`Você não tem permissão para executar "${skill.name}" agora.`);
      }
      return await skill.execute(payload, ctx);
    } catch (err) {
      return skillResult.error(err instanceof Error ? err.message : "Falha na execução.");
    }
  }
}

export const BellaSkillRegistry = new BellaSkillRegistryImpl();
export type { BellaSkill } from "./types";