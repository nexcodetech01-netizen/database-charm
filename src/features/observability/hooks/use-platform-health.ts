/**
 * Hooks de observabilidade — leitura direta via RLS.
 *
 * Todas as consultas são protegidas por RLS:
 *  - `job_runs`: apenas usuários com permissão de configurações.
 *  - `integration_dead_letters`: apenas dentro da própria empresa.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface JobRunRow {
  id: string;
  job_name: string;
  status: "running" | "success" | "error";
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  result: unknown;
  error_message: string | null;
}

export interface ScheduledJob {
  job_name: string;
  schedule: string;
  active: boolean;
}

const STALE = 30_000;

export function useJobRuns(limit = 50) {
  return useQuery({
    queryKey: ["observability", "job-runs", limit],
    staleTime: STALE,
    queryFn: async (): Promise<JobRunRow[]> => {
      const { data, error } = await supabase
        .from("job_runs")
        .select("id, job_name, status, started_at, finished_at, duration_ms, result, error_message")
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as JobRunRow[];
    },
  });
}

export function useScheduledJobs() {
  return useQuery({
    queryKey: ["observability", "scheduled-jobs"],
    staleTime: 60_000,
    queryFn: async (): Promise<ScheduledJob[]> => {
      const { data, error } = await supabase.rpc("nexos_jobs_status");
      if (error) throw error;
      return (data ?? []) as unknown as ScheduledJob[];
    },
  });
}

export interface DeadLetterRow {
  id: string;
  source: string;
  topic: string | null;
  reference: string | null;
  status: string;
  attempts: number;
  error_message: string | null;
  created_at: string;
}

export function useDeadLetters(limit = 25) {
  return useQuery({
    queryKey: ["observability", "dead-letters", limit],
    staleTime: STALE,
    queryFn: async (): Promise<DeadLetterRow[]> => {
      const { data, error } = await supabase
        .from("integration_dead_letters")
        .select("id, source, topic, reference, status, attempts, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as DeadLetterRow[];
    },
  });
}

/** Agrega as execuções por job para o painel de status. */
export interface JobSummary {
  jobName: string;
  lastRunAt: string | null;
  lastStatus: JobRunRow["status"] | null;
  successRate: number;
  avgDurationMs: number;
  runs: number;
}

export function summarizeRuns(rows: JobRunRow[]): JobSummary[] {
  const byJob = new Map<string, JobRunRow[]>();
  for (const row of rows) {
    const list = byJob.get(row.job_name) ?? [];
    list.push(row);
    byJob.set(row.job_name, list);
  }
  return [...byJob.entries()]
    .map(([jobName, list]) => {
      const finished = list.filter((r) => r.status !== "running");
      const success = finished.filter((r) => r.status === "success").length;
      const durations = list.map((r) => r.duration_ms ?? 0).filter((d) => d > 0);
      return {
        jobName,
        lastRunAt: list[0]?.started_at ?? null,
        lastStatus: list[0]?.status ?? null,
        successRate: finished.length ? Math.round((success / finished.length) * 100) : 0,
        avgDurationMs: durations.length
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0,
        runs: list.length,
      };
    })
    .sort((a, b) => a.jobName.localeCompare(b.jobName));
}
