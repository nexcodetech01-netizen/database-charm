/**
 * Telemetria de execução dos jobs automáticos (server-only).
 *
 * Cada execução de `/api/public/jobs/*` grava uma linha em `public.job_runs`
 * (running → success/error), alimentando o Dashboard de Saúde.
 *
 * Nunca lança: falha de telemetria não pode derrubar o job.
 */

export type JobRunStatus = "running" | "success" | "error";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (t: string) => any;
  };
}

export async function startJobRun(jobName: string): Promise<string | null> {
  try {
    const db = await admin();
    const { data, error } = await db
      .from("job_runs")
      .insert({ job_name: jobName, status: "running" })
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: string }).id;
  } catch (err) {
    console.warn("[jobs] falha ao registrar início", jobName, err);
    return null;
  }
}

export async function finishJobRun(
  runId: string | null,
  outcome: { ok: boolean; result?: unknown; errorMessage?: string; startedAt?: number },
): Promise<void> {
  if (!runId) return;
  try {
    const db = await admin();
    await db
      .from("job_runs")
      .update({
        status: outcome.ok ? "success" : "error",
        finished_at: new Date().toISOString(),
        duration_ms: outcome.startedAt ? Date.now() - outcome.startedAt : null,
        result: (outcome.result ?? {}) as Record<string, unknown>,
        error_message: outcome.errorMessage?.slice(0, 2000) ?? null,
      })
      .eq("id", runId);
  } catch (err) {
    console.warn("[jobs] falha ao registrar fim", runId, err);
  }
}

/**
 * Envelope padrão: registra início/fim e devolve a `Response` do job.
 * O handler recebe nada e devolve `{ response, ok, result }`.
 */
export async function withJobRun(
  jobName: string,
  fn: () => Promise<{ response: Response; ok: boolean; result?: unknown; error?: string }>,
): Promise<Response> {
  const startedAt = Date.now();
  const runId = await startJobRun(jobName);
  try {
    const outcome = await fn();
    await finishJobRun(runId, {
      ok: outcome.ok,
      result: outcome.result,
      errorMessage: outcome.error,
      startedAt,
    });
    console.info(
      JSON.stringify({
        scope: "jobs",
        job: jobName,
        ok: outcome.ok,
        durationMs: Date.now() - startedAt,
      }),
    );
    return outcome.response;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishJobRun(runId, { ok: false, errorMessage: message, startedAt });
    console.error(JSON.stringify({ scope: "jobs", job: jobName, ok: false, error: message }));
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * Envelope simplificado: executa o handler, grava a telemetria a partir da
 * `Response` devolvida e repassa a resposta ao chamador.
 */
export async function runJob(jobName: string, handler: () => Promise<Response>): Promise<Response> {
  const startedAt = Date.now();
  const runId = await startJobRun(jobName);
  try {
    const response = await handler();
    let result: unknown = {};
    try {
      result = await response.clone().json();
    } catch {
      result = {};
    }
    const ok = response.ok;
    await finishJobRun(runId, {
      ok,
      result,
      startedAt,
      errorMessage: ok ? undefined : `HTTP ${response.status}`,
    });
    console.info(
      JSON.stringify({ scope: "jobs", job: jobName, ok, durationMs: Date.now() - startedAt }),
    );
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishJobRun(runId, { ok: false, errorMessage: message, startedAt });
    console.error(JSON.stringify({ scope: "jobs", job: jobName, ok: false, error: message }));
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
