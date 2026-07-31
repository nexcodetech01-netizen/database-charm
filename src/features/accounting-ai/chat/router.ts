/**
 * Chat Router — orquestra a execução das skills do plano.
 * Não implementa cálculo nem acesso direto a dados: apenas invoca
 * as skills já registradas na Bella Contadora.
 */
import type { ProviderDeps } from "../providers";
import { getAccountingSkill } from "../skills";
import type { ChatPlan, ChatSkillOutcome } from "./types";

export interface RouteOptions {
  deps?: ProviderDeps;
}

export async function executePlan(
  plan: ChatPlan,
  companyId: string,
  options: RouteOptions = {},
): Promise<ChatSkillOutcome[]> {
  const outcomes: ChatSkillOutcome[] = [];

  for (const step of plan.steps) {
    const skill = getAccountingSkill(step.skillId);
    if (!skill) {
      outcomes.push({
        skillId: step.skillId,
        ok: false,
        text: "",
        data: null,
        error: `Skill "${step.skillId}" não registrada.`,
      });
      continue;
    }
    try {
      const result = await skill.run(companyId, options.deps);
      outcomes.push({
        skillId: step.skillId,
        ok: result.ok,
        text: result.text,
        data: result.data ?? null,
      });
    } catch (err) {
      outcomes.push({
        skillId: step.skillId,
        ok: false,
        text: "",
        data: null,
        error: err instanceof Error ? err.message : "Falha ao consultar os dados.",
      });
    }
  }

  return outcomes;
}
