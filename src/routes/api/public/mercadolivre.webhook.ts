/**
 * Webhook público do Mercado Livre.
 *
 * A lógica de validação e processamento vive em
 * `@/lib/mercadolivre-webhook.server` para poder ser reprocessada pela
 * Dead Letter Queue.
 */
import { createFileRoute } from "@tanstack/react-router";
import { enforceRateLimit } from "@/lib/rate-limit.server";

export const Route = createFileRoute("/api/public/mercadolivre/webhook")({
  server: {
    handlers: {
      GET: async () => new Response("ok", { status: 200 }),
      POST: async ({ request }) => {
        const limited = enforceRateLimit({
          route: "ml:webhook",
          max: 300,
          windowMs: 60_000,
        });
        if (limited) return limited;

        let notif: unknown;
        try {
          notif = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!notif || typeof notif !== "object" || Array.isArray(notif)) {
          return new Response("invalid payload", { status: 400 });
        }

        const { processMercadoLivreNotification } =
          await import("@/lib/mercadolivre-webhook.server");
        const { recordDeadLetter } = await import("@/lib/dead-letter.server");

        try {
          const outcome = await processMercadoLivreNotification(notif);
          if (outcome.deadLetter) {
            await recordDeadLetter({
              companyId: outcome.companyId ?? null,
              source: "mercadolivre",
              topic: (notif as { topic?: string }).topic ?? null,
              reference: (notif as { resource?: string }).resource ?? null,
              payload: notif,
              errorMessage: outcome.body,
            });
          }
          return new Response(outcome.body, { status: outcome.status });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[ml-webhook] erro inesperado", message);
          await recordDeadLetter({
            source: "mercadolivre",
            topic: (notif as { topic?: string }).topic ?? null,
            reference: (notif as { resource?: string }).resource ?? null,
            payload: notif,
            errorMessage: message,
          });
          // ACK 200: a notificação já está na DLQ para reprocessamento.
          return new Response("queued for retry", { status: 200 });
        }
      },
    },
  },
});
