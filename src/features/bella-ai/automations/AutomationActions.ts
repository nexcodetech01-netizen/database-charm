/**
 * AutomationActions
 *
 * Traduz `AutomationActionDef` (config) em payload real para o
 * `BellaActionEngine.executeSkill`. Também define a lista de Skills
 * BLOQUEADAS para automações — nada que apague dados de forma
 * irreversível pode ser disparado sem intervenção humana.
 */
import { AutomationConditions } from "./AutomationConditions";
import type { AutomationActionDef, AutomationEvent } from "./types";

/**
 * Skills destrutivas explicitamente proibidas em automações. Mantém a
 * regra fora do engine: adicionar/remover uma Skill deste conjunto é uma
 * decisão de segurança clara e auditável.
 */
export const DESTRUCTIVE_SKILL_IDS: ReadonlySet<string> = new Set<string>([
  // finance
  "finance.delete_transaction",
  // customers
  "customer.delete",
  // products / inventory
  "product.delete",
  "inventory.adjust_manual",
  // sales
  "sale.cancel",
  "sale.refund_full",
]);

export const AutomationActions = {
  isBlocked(skillId: string): boolean {
    return DESTRUCTIVE_SKILL_IDS.has(skillId);
  },

  /** Monta o payload final para a Skill a partir de `params` + `paramsFromEvent`. */
  resolvePayload(
    def: AutomationActionDef,
    event: AutomationEvent,
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = { ...(def.params ?? {}) };
    const mapping = def.paramsFromEvent ?? {};
    for (const [targetKey, path] of Object.entries(mapping)) {
      const v = AutomationConditions.readPath(event.payload, path);
      if (v !== undefined) payload[targetKey] = v;
    }
    return payload;
  },
};
