/**
 * AutomationRunner
 *
 * Executa UMA automação: avalia condições, dispara cada ação via
 * `BellaSkillRegistry` (o mesmo funil usado pelo `BellaActionEngine`)
 * e devolve um resultado agregado. Não consulta banco — recebe a
 * automação e o evento já resolvidos.
 */
// Import removido para evitar vazamento de código server-only no cliente.
// O runner deve receber o Registry como dependência se necessário.

import { AutomationActions } from "./AutomationActions";
import { AutomationConditions } from "./AutomationConditions";
import type {
  Automation,
  AutomationActionOutcome,
  AutomationEvent,
  AutomationRunStatus,
} from "./types";

export interface AutomationRunResult {
  status: AutomationRunStatus;
  durationMs: number;
  actionsSummary: AutomationActionOutcome[];
  error: string | null;
}

export const AutomationRunner = {
  async run(
    automation: Automation,
    event: AutomationEvent,
    deps: { skills?: { has(id: string): boolean; execute(id: string, payload: any, ctx: any): Promise<any> } } = {}
  ): Promise<AutomationRunResult> {
    const startedAt = Date.now();
    if (!automation.enabled) {
      return { status: "skipped", durationMs: 0, actionsSummary: [], error: null };
    }
    if (!AutomationConditions.evaluate(automation.conditions, event.payload)) {
      return {
        status: "skipped",
        durationMs: Date.now() - startedAt,
        actionsSummary: [],
        error: null,
      };
    }

    const outcomes: AutomationActionOutcome[] = [];
    let hasError = false;
    let hasSuccess = false;

    for (const def of automation.actions) {
      const label = def.label ?? def.skillId;

      if (AutomationActions.isBlocked(def.skillId)) {
        outcomes.push({
          skillId: def.skillId,
          label,
          ok: false,
          message: "Skill destrutiva bloqueada em automações.",
        });
        hasError = true;
        continue;
      }
      if (deps.skills && !deps.skills.has(def.skillId)) {
        outcomes.push({
          skillId: def.skillId,
          label,
          ok: false,
          message: `Skill "${def.skillId}" não está registrada.`,
        });
        hasError = true;
        continue;
      }

      try {
        if (!deps.skills) throw new Error("Skill Registry não disponível.");
        const result = await deps.skills.execute(def.skillId, payload, {
          companyId: automation.companyId,
          userId: null,
        });
        outcomes.push({ skillId: def.skillId, label, ok: result.ok, message: result.message });
        if (result.ok) hasSuccess = true;
        else hasError = true;
      } catch (err) {
        outcomes.push({
          skillId: def.skillId,
          label,
          ok: false,
          message: err instanceof Error ? err.message : "Falha inesperada.",
        });
        hasError = true;
      }
    }

    const status: AutomationRunStatus =
      hasError && hasSuccess ? "partial" : hasError ? "error" : "success";

    return {
      status,
      durationMs: Date.now() - startedAt,
      actionsSummary: outcomes,
      error: null,
    };
  },
};
