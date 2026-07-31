/**
 * AutomationScheduler — stub
 *
 * Ponto de extensão para triggers baseados em tempo (estoque crítico,
 * clientes inativos, cobranças vencidas, agendamentos próximos). A
 * execução real vem de um cron externo (pg_cron → rota pública) que
 * chama `runScheduledTriggers` com o Supabase client autenticado.
 *
 * Nesta versão apenas define o contrato — a implementação por trigger
 * é responsabilidade de cada módulo (Sprint seguinte).
 */
import type { AutomationTriggerType } from "./types";

export type ScheduledTriggerHandler = (supabase: {
  from: (t: string) => any;
}) => Promise<void>;

class AutomationSchedulerImpl {
  private handlers = new Map<AutomationTriggerType, ScheduledTriggerHandler>();

  register(trigger: AutomationTriggerType, handler: ScheduledTriggerHandler): void {
    this.handlers.set(trigger, handler);
  }

  list(): AutomationTriggerType[] {
    return Array.from(this.handlers.keys());
  }

  async runAll(supabase: { from: (t: string) => any }): Promise<void> {
    for (const [, handler] of this.handlers) {
      try {
        await handler(supabase);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[automations] scheduler handler failed:", err);
      }
    }
  }
}

export const AutomationScheduler = new AutomationSchedulerImpl();
