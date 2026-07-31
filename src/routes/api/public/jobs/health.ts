/**
 * Job: health check da plataforma.
 *
 * Verifica dependências críticas e grava o resultado em `public.job_runs`,
 * alimentando o Dashboard de Saúde (`/saude-do-sistema`).
 *
 * Autenticação: `Authorization: Bearer <CRON_JOB_SECRET>`.
 * Agendado por `public.schedule_nexos_jobs()` a cada 10 minutos.
 */
import { createFileRoute } from "@tanstack/react-router";
import { authorizeJobRequest } from "@/lib/job-auth.server";
import { enforceRateLimit } from "@/lib/rate-limit.server";
import { withJobRun } from "@/lib/job-runs.server";

interface CheckResult {
  name: string;
  ok: boolean;
  durationMs: number;
  detail?: string;
}

async function timed(name: string, fn: () => Promise<string | void>): Promise<CheckResult> {
  const started = Date.now();
  try {
    const detail = await fn();
    return { name, ok: true, durationMs: Date.now() - started, detail: detail ?? undefined };
  } catch (err) {
    return {
      name,
      ok: false,
      durationMs: Date.now() - started,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export const Route = createFileRoute("/api/public/jobs/health")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Hardening: throttle por IP antes mesmo da checagem do segredo.
        const limited = enforceRateLimit({ route: "jobs:health", windowMs: 60_000, max: 12 });
        if (limited) return limited;

        const denied = authorizeJobRequest(request);
        if (denied) return denied;

        return withJobRun("health", async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const db = supabaseAdmin as any;

          const checks: CheckResult[] = [];

          checks.push(
            await timed("database", async () => {
              const { error } = await db.from("companies").select("id").limit(1);
              if (error) throw new Error(error.message);
              return "ok";
            }),
          );

          checks.push(
            await timed("dead_letter_queue", async () => {
              const { count, error } = await db
                .from("integration_dead_letters")
                .select("id", { count: "exact", head: true })
                .eq("status", "pending");
              if (error) throw new Error(error.message);
              if ((count ?? 0) > 50) throw new Error(`${count} itens pendentes na DLQ`);
              return `${count ?? 0} pendentes`;
            }),
          );

          checks.push(
            await timed("mercadolivre_tokens", async () => {
              const { count, error } = await db
                .from("mercadolivre_integrations")
                .select("company_id", { count: "exact", head: true })
                .not("refresh_token_encrypted", "is", null);
              if (error) throw new Error(error.message);
              return `${count ?? 0} integrações ativas`;
            }),
          );

          checks.push(
            await timed("secrets", async () => {
              const missing = [
                ["CRON_JOB_SECRET", process.env.CRON_JOB_SECRET],
                ["SUPABASE_URL", process.env.SUPABASE_URL],
                ["SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY],
              ]
                .filter(([, v]) => !v)
                .map(([k]) => k);
              if (missing.length > 0) throw new Error(`ausentes: ${missing.join(", ")}`);
              return "ok";
            }),
          );

          const ok = checks.every((c) => c.ok);
          const result = { checks, ok, checkedAt: new Date().toISOString() };

          return {
            ok,
            result,
            error: ok
              ? undefined
              : checks
                  .filter((c) => !c.ok)
                  .map((c) => `${c.name}: ${c.detail}`)
                  .join(" | "),
            response: Response.json(result, { status: ok ? 200 : 503 }),
          };
        });
      },
    },
  },
});
