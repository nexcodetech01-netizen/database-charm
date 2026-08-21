/**
 * AutomationValidator
 *
 * Validação síncrona da configuração de uma automação antes de persistir.
 * Não consulta banco nem executa Skills; apenas garante que a definição
 * é bem-formada e não tenta invocar uma Skill destrutiva.
 */
import { BellaSkillRegistry } from "../skills/registry";
import { AutomationActions } from "./AutomationActions";
import type { Automation } from "./types";

export interface AutomationValidationIssue {
  field: string;
  message: string;
}

export const AutomationValidator = {
  validate(input: Pick<Automation, "name" | "triggerType" | "actions" | "conditions">): AutomationValidationIssue[] {
    const issues: AutomationValidationIssue[] = [];
    if (!input.name || input.name.trim().length < 3) {
      issues.push({ field: "name", message: "Nome deve ter ao menos 3 caracteres." });
    }
    if (!input.triggerType) {
      issues.push({ field: "triggerType", message: "Gatilho é obrigatório." });
    }
    if (!Array.isArray(input.actions) || input.actions.length === 0) {
      issues.push({ field: "actions", message: "Adicione ao menos uma ação." });
    } else {
      input.actions.forEach((a, idx) => {
        if (!a.skillId) {
          issues.push({ field: `actions.${idx}.skillId`, message: "Skill é obrigatória." });
          return;
        }
        if (AutomationActions.isBlocked(a.skillId)) {
          issues.push({
            field: `actions.${idx}.skillId`,
            message: `Skill "${a.skillId}" é destrutiva e não pode ser automatizada.`,
          });
        }
        if (!BellaSkillRegistry.has(a.skillId)) {
          issues.push({
            field: `actions.${idx}.skillId`,
            message: `Skill "${a.skillId}" não está registrada.`,
          });
        }
      });
    }
    (input.conditions ?? []).forEach((c, idx) => {
      if (!c.path) issues.push({ field: `conditions.${idx}.path`, message: "Path é obrigatório." });
      if (!c.operator) issues.push({ field: `conditions.${idx}.operator`, message: "Operador é obrigatório." });
    });
    return issues;
  },
};
