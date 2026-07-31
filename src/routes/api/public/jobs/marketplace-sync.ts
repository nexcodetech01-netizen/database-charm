/**
 * Job: consumo da fila de sincronização de marketplace (Mercado Livre).
 *
 * A fila `public.marketplace_sync_queue` é alimentada por trigger no
 * `products`, então qualquer alteração de estoque (venda, PDV, compra,
 * cancelamento, devolução, ajuste) chega aqui sem acoplar o motor de vendas.
 *
 * Agendar via pg_cron (a cada minuto/5 min).
 */
import { createFileRoute } from "@tanstack/react-router";
import { authorizeJobRequest } from "@/lib/job-auth.server";
import { enforceRateLimit } from "@/lib/rate-limit.server";
import { runJob } from "@/lib/job-runs.server";

export const Route = createFileRoute("/api/public/jobs/marketplace-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limited = enforceRateLimit({
          route: "jobs:marketplace-sync",
          windowMs: 60_000,
          max: 30,
        });
        if (limited) return limited;

        const denied = authorizeJobRequest(request);
        if (denied) return denied;

        return runJob("marketplace-sync", async () => {
          const { drainMarketplaceSyncQueue } = await import("@/lib/marketplace-sync.server");
          try {
            const summary = await drainMarketplaceSyncQueue(25);
            return Response.json({ ok: true, ...summary });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return Response.json({ ok: false, error: message }, { status: 500 });
          }
        });
      },
    },
  },
});
