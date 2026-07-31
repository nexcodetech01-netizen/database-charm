/**
 * AutomationEngine
 *
 * Facade principal do módulo. Recebe um evento, busca todas as
 * automações ativas da empresa para aquele trigger, roda cada uma
 * (avaliação de condições + ações) e persiste os logs. Nenhum
 * consumidor externo (webhooks, scheduler, triggers de módulos)
 * deve manipular Runner/Registry/Execution diretamente — tudo passa
 * pelo `dispatch` daqui.
 */
import { fetchAutomationsFor } from "./AutomationRegistry";
import { AutomationRunner } from "./AutomationRunner";
import { persistAutomationRun } from "./AutomationExecution";
import type { AutomationEvent } from "./types";

export interface DispatchSummary {
  matched: number;
  executed: number;
  successes: number;
  failures: number;
}

/**
 * `supabase`: um client autenticado (server-side ou admin) capaz de
 * ler `bella_automations` e escrever `bella_automation_runs`.
 */
export const AutomationEngine = {
  async dispatch(
    supabase: { from: (t: string) => any },
    event: AutomationEvent,
  ): Promise<DispatchSummary> {
    const list = await fetchAutomationsFor(supabase, event.companyId, event.triggerType);
    const summary: DispatchSummary = {
      matched: list.length,
      executed: 0,
      successes: 0,
      failures: 0,
    };

    for (const automation of list) {
      const result = await AutomationRunner.run(automation, event);
      if (result.status === "skipped") {
        // Ainda registra para dar visibilidade "por que não rodou".
        await persistAutomationRun(supabase, {
          automation,
          status: "skipped",
          durationMs: result.durationMs,
          triggerPayload: event.payload,
          actionsSummary: [],
          error: null,
        });
        continue;
      }
      summary.executed += 1;
      if (result.status === "success") summary.successes += 1;
      if (result.status === "error") summary.failures += 1;
      await persistAutomationRun(supabase, {
        automation,
        status: result.status,
        durationMs: result.durationMs,
        triggerPayload: event.payload,
        actionsSummary: result.actionsSummary,
        error: result.error,
      });
    }
    return summary;
  },
};
