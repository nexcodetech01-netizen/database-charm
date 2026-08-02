/**
 * Job: reprocessamento da Dead Letter Queue de integrações.
 *
 * Agendar via pg_cron (a cada 15 min).
 */
import { createFileRoute } from "@tanstack/react-router";
import { authorizeJobRequest } from "@/lib/job-auth.server";
import { enforceRateLimit } from "@/lib/rate-limit.server";
import { runJob } from "@/lib/job-runs.server";
import { requireServiceKey } from "@/lib/job-admin.server";

export const Route = createFileRoute("/api/public/jobs/dlq-reprocess")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Hardening: throttle por IP antes mesmo da checagem do segredo.
        const limited = enforceRateLimit({ route: "jobs:dlq-reprocess", windowMs: 60_000, max: 12 });
        if (limited) return limited;

        const denied = authorizeJobRequest(request);
        if (denied) return denied;

        const noServiceKey = requireServiceKey("dlq-reprocess");
        if (noServiceKey) return noServiceKey;

        return runJob("dlq-reprocess", async () => {

          const { listPendingDeadLetters, markDeadLetterResult } =
            await import("@/lib/dead-letter.server");

          let entries;
          try {
            entries = await listPendingDeadLetters(25);
          } catch (err) {
            return Response.json(
              { ok: false, error: err instanceof Error ? err.message : String(err) },
              { status: 500 },
            );
          }

          let resolved = 0;
          let failed = 0;

          for (const entry of entries) {
            try {
              if (entry.source === "mercadolivre" && entry.topic === "orders_v2") {
                const { processMercadoLivreNotification } =
                  await import("@/lib/mercadolivre-webhook.server");
                const outcome = await processMercadoLivreNotification(
                  entry.payload as Record<string, unknown>,
                );
                if (outcome.status >= 400 || outcome.deadLetter) {
                  throw new Error(outcome.body);
                }
              } else {
                // Sem handler específico: marca como falha definitiva após as
                // tentativas, evitando reprocessamento infinito.
                throw new Error(
                  `sem handler de reprocessamento para ${entry.source}/${entry.topic ?? "-"}`,
                );
              }
              await markDeadLetterResult(entry.id, {
                ok: true,
                attempts: entry.attempts,
              });
              resolved += 1;
            } catch (err) {
              await markDeadLetterResult(entry.id, {
                ok: false,
                attempts: entry.attempts,
                errorMessage: err instanceof Error ? err.message : String(err),
              });
              failed += 1;
            }
          }

          return Response.json({ ok: true, processed: entries.length, resolved, failed });
        });
      },
    },
  },
});
