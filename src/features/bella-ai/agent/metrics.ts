/**
 * Métricas ampliadas do Agent Runtime — leitura agregada de
 * `public.bella_executions`. Consulta somente.
 *
 * Complementa `fetchAgentMetrics` incluindo contagem de fallbacks
 * (linhas com `error_message` iniciando em "fallback:").
 */
// Supabase import removed to prevent client-side leaks when this file is imported by server-only logic or vice versa.
// In this specific project, supabase client is intended to be used only where appropriate.
// import { supabase } from "@/integrations/supabase/client";
// Importação removida para evitar vazamento de runtime.ts (que importa Registry) para o cliente.
// O prefixo é fixo em "fallback:".
const FALLBACK_LOG_PREFIX = "fallback:";

export interface AgentRuntimeMetricsWindow {
  companyId: string;
  sinceIso: string;
}

export interface AgentRuntimeMetricsSummary {
  totalExecutions: number;
  successful: number;
  failures: number;
  fallbacks: number;
  successRate: number;
  avgExecutionMs: number;
  topSkills: Array<{ skillId: string; count: number }>;
  topIntents: Array<{ intent: string; count: number }>;
}

interface Row {
  skill_id: string | null;
  intent: string | null;
  success: boolean;
  execution_time_ms: number | null;
  error_message: string | null;
}

export async function fetchAgentRuntimeMetrics(
  input: AgentRuntimeMetricsWindow,
): Promise<AgentRuntimeMetricsSummary> {
  const { supabase: supabaseClient } = await import("@/integrations/supabase/client");
  const { data, error } = await supabaseClient
    .from("bella_executions")
    .select("skill_id,intent,success,execution_time_ms,error_message")
    .eq("company_id", input.companyId)
    .gte("started_at", input.sinceIso)
    .order("started_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  const rows = (data ?? []) as Row[];
  const total = rows.length;
  const successful = rows.filter((r) => r.success).length;
  const fallbacks = rows.filter((r) =>
    (r.error_message ?? "").startsWith(FALLBACK_LOG_PREFIX),
  ).length;
  const failures = total - successful - fallbacks < 0 ? 0 : total - successful - fallbacks;

  const durations = rows.map((r) => r.execution_time_ms ?? 0).filter((n) => n > 0);
  const avg = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  return {
    totalExecutions: total,
    successful,
    failures,
    fallbacks,
    successRate: total === 0 ? 0 : successful / total,
    avgExecutionMs: avg,
    topSkills: rank(rows.map((r) => r.skill_id).filter((v): v is string => !!v)).map(
      ([skillId, count]) => ({ skillId, count }),
    ),
    topIntents: rank(rows.map((r) => r.intent).filter((v): v is string => !!v)).map(
      ([intent, count]) => ({ intent, count }),
    ),
  };
}

export interface AgentExecutionLogRow {
  id: string;
  startedAt: string;
  intent: string | null;
  skillId: string | null;
  success: boolean;
  resultCode: string | null;
  errorMessage: string | null;
  executionTimeMs: number | null;
  confirmationRequired: boolean;
  confirmed: boolean;
  parameters: Record<string, unknown> | null;
}

export async function fetchAgentExecutionLog(
  input: AgentRuntimeMetricsWindow & { limit?: number },
): Promise<AgentExecutionLogRow[]> {
  const { supabase: supabaseClient } = await import("@/integrations/supabase/client");
  const { data, error } = await supabaseClient
    .from("bella_executions")
    .select(
      "id,started_at,intent,skill_id,success,result_code,error_message,execution_time_ms,confirmation_required,confirmed,parameters",
    )
    .eq("company_id", input.companyId)
    .gte("started_at", input.sinceIso)
    .order("started_at", { ascending: false })
    .limit(input.limit ?? 50);

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id as string,
    startedAt: r.started_at as string,
    intent: (r.intent as string | null) ?? null,
    skillId: (r.skill_id as string | null) ?? null,
    success: !!r.success,
    resultCode: (r.result_code as string | null) ?? null,
    errorMessage: (r.error_message as string | null) ?? null,
    executionTimeMs: (r.execution_time_ms as number | null) ?? null,
    confirmationRequired: !!r.confirmation_required,
    confirmed: !!r.confirmed,
    parameters: (r.parameters as Record<string, unknown> | null) ?? null,
  }));
}

function rank(values: string[]): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}
