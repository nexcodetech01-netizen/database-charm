/**
 * AutomationExecution
 *
 * Persistência dos runs + atualização dos contadores da automação.
 * Isolado do runner para permitir testar a orquestração sem banco.
 */
import type {
  Automation,
  AutomationActionOutcome,
  AutomationRunStatus,
} from "./types";

export interface RunPersistenceInput {
  automation: Automation;
  status: AutomationRunStatus;
  durationMs: number;
  triggerPayload: Record<string, unknown>;
  actionsSummary: AutomationActionOutcome[];
  error: string | null;
}

export async function persistAutomationRun(
  supabase: { from: (t: string) => any },
  input: RunPersistenceInput,
): Promise<void> {
  const { automation } = input;
  const { error: insertErr } = await supabase.from("bella_automation_runs").insert({
    automation_id: automation.id,
    company_id: automation.companyId,
    trigger_type: automation.triggerType,
    trigger_payload: input.triggerPayload,
    status: input.status,
    duration_ms: input.durationMs,
    actions_summary: input.actionsSummary,
    error: input.error,
  });
  if (insertErr) {
    // Log estruturado, mas não interrompe o fluxo do engine.
    // eslint-disable-next-line no-console
    console.error("[automations] failed to persist run:", insertErr.message);
  }

  const patch: Record<string, unknown> = {
    last_run_at: new Date().toISOString(),
    last_run_status: input.status,
    run_count: automation.runCount + 1,
    success_count: automation.successCount + (input.status === "success" ? 1 : 0),
    failure_count: automation.failureCount + (input.status === "error" ? 1 : 0),
  };
  const { error: updErr } = await supabase
    .from("bella_automations")
    .update(patch)
    .eq("id", automation.id);
  if (updErr) {
    // eslint-disable-next-line no-console
    console.error("[automations] failed to update counters:", updErr.message);
  }
}
