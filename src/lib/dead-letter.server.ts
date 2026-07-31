/**
 * Dead Letter Queue de integrações externas (server-only).
 *
 * Toda falha de processamento de webhook/job que não pode ser resolvida na
 * hora é registrada em `public.integration_dead_letters` para reprocessamento
 * posterior — em vez de ser apenas logada e perdida.
 */

export type DeadLetterStatus = "pending" | "retrying" | "resolved" | "failed";

export interface DeadLetterInput {
  companyId?: string | null;
  source: string;
  topic?: string | null;
  reference?: string | null;
  payload: unknown;
  errorMessage: string;
}

export interface DeadLetterRow {
  id: string;
  company_id: string | null;
  source: string;
  topic: string | null;
  reference: string | null;
  payload: unknown;
  error_message: string | null;
  attempts: number;
  status: DeadLetterStatus;
}

const MAX_ATTEMPTS = 5;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // A tabela ainda não faz parte dos tipos gerados.
  return supabaseAdmin as unknown as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (t: string) => any;
  };
}

/** Registra (ou incrementa) uma entrada na DLQ. Nunca lança. */
export async function recordDeadLetter(input: DeadLetterInput): Promise<void> {
  try {
    const db = await admin();
    const { error } = await db.from("integration_dead_letters").insert({
      company_id: input.companyId ?? null,
      source: input.source,
      topic: input.topic ?? null,
      reference: input.reference ?? null,
      payload: (input.payload ?? {}) as Record<string, unknown>,
      error_message: input.errorMessage.slice(0, 2000),
      status: "pending",
      attempts: 0,
    });
    if (error) {
      console.error("[dlq] falha ao registrar dead letter:", error.message);
    }
  } catch (err) {
    console.error(
      "[dlq] exceção ao registrar dead letter:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function listPendingDeadLetters(limit = 25): Promise<DeadLetterRow[]> {
  const db = await admin();
  const { data, error } = await db
    .from("integration_dead_letters")
    .select("*")
    .in("status", ["pending", "retrying"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as DeadLetterRow[];
}

export async function markDeadLetterResult(
  id: string,
  outcome: { ok: boolean; attempts: number; errorMessage?: string },
): Promise<void> {
  const db = await admin();
  const nextAttempts = outcome.attempts + 1;
  const status: DeadLetterStatus = outcome.ok
    ? "resolved"
    : nextAttempts >= MAX_ATTEMPTS
      ? "failed"
      : "retrying";
  await db
    .from("integration_dead_letters")
    .update({
      status,
      attempts: nextAttempts,
      last_attempt_at: new Date().toISOString(),
      resolved_at: outcome.ok ? new Date().toISOString() : null,
      error_message: outcome.errorMessage?.slice(0, 2000) ?? null,
    })
    .eq("id", id);
}

export const DEAD_LETTER_MAX_ATTEMPTS = MAX_ATTEMPTS;
