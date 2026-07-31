/**
 * Observabilidade do Agente — leituras agregadas de `bella_executions`.
 * Só consulta; nunca escreve.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AgentMetricsWindow {
  companyId: string;
  sinceIso: string;
}

export interface AgentMetricsSummary {
  totalExecutions: number;
  successRate: number;
  avgExecutionMs: number;
  topSkills: Array<{ skillId: string; count: number }>;
  topIntents: Array<{ intent: string; count: number }>;
  failures: number;
}

interface Row {
  skill_id: string | null;
  intent: string | null;
  success: boolean;
  execution_time_ms: number | null;
}

export async function fetchAgentMetrics(input: AgentMetricsWindow): Promise<AgentMetricsSummary> {
  const { data, error } = await supabase
    .from("bella_executions")
    .select("skill_id,intent,success,execution_time_ms")
    .eq("company_id", input.companyId)
    .gte("started_at", input.sinceIso)
    .limit(1000);

  if (error) throw error;

  const rows = (data ?? []) as Row[];
  const total = rows.length;
  const success = rows.filter((r) => r.success).length;
  const durations = rows.map((r) => r.execution_time_ms ?? 0);
  const avg = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  return {
    totalExecutions: total,
    successRate: total === 0 ? 0 : success / total,
    avgExecutionMs: avg,
    failures: total - success,
    topSkills: rank(rows.map((r) => r.skill_id).filter(Boolean) as string[]).map(
      ([skillId, count]) => ({ skillId, count }),
    ),
    topIntents: rank(rows.map((r) => r.intent).filter(Boolean) as string[]).map(
      ([intent, count]) => ({ intent, count }),
    ),
  };
}

function rank(values: string[]): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}
