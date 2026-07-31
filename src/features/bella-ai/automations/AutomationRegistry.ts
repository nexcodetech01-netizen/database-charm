/**
 * AutomationRegistry
 *
 * Ponto único de acesso às automações de uma empresa. Isola queries do
 * runner — permite trocar a fonte (banco, cache, memória) sem afetar
 * a orquestração.
 */
import type { Automation, AutomationTriggerType } from "./types";

export interface AutomationRow {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger_type: string;
  trigger_config: unknown;
  conditions: unknown;
  actions: unknown;
  template_id: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  run_count: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export function mapAutomationRow(r: AutomationRow): Automation {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    description: r.description,
    enabled: r.enabled,
    triggerType: r.trigger_type as AutomationTriggerType,
    triggerConfig: (r.trigger_config ?? {}) as Automation["triggerConfig"],
    conditions: Array.isArray(r.conditions) ? (r.conditions as Automation["conditions"]) : [],
    actions: Array.isArray(r.actions) ? (r.actions as Automation["actions"]) : [],
    templateId: r.template_id,
    lastRunAt: r.last_run_at,
    lastRunStatus: (r.last_run_status ?? null) as Automation["lastRunStatus"],
    runCount: r.run_count,
    successCount: r.success_count,
    failureCount: r.failure_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Busca automações ativas por trigger. Recebe o Supabase client já
 * autenticado — o registry não conhece as credenciais.
 */
export async function fetchAutomationsFor(
  supabase: { from: (t: string) => any },
  companyId: string,
  triggerType: AutomationTriggerType,
): Promise<Automation[]> {
  const { data, error } = await supabase
    .from("bella_automations")
    .select("*")
    .eq("company_id", companyId)
    .eq("trigger_type", triggerType)
    .eq("enabled", true);
  if (error) throw new Error(error.message);
  return ((data ?? []) as AutomationRow[]).map(mapAutomationRow);
}
