/**
 * Job: reconciliação de pedidos pagos do Mercado Livre.
 *
 * Reprocessa (de forma idempotente) os pedidos pagos das últimas 24h para
 * cobrir notificações perdidas. A idempotência é garantida pelo índice único
 * `uq_inventory_external_reference`.
 *
 * Agendar via pg_cron (a cada hora).
 */
import { createFileRoute } from "@tanstack/react-router";
import { authorizeJobRequest } from "@/lib/job-auth.server";
import { enforceRateLimit } from "@/lib/rate-limit.server";
import { runJob } from "@/lib/job-runs.server";
import { requireServiceKey } from "@/lib/job-admin.server";

const ML_API = "https://api.mercadolibre.com";
const WINDOW_HOURS = 24;

interface MLSearchResult {
  results?: Array<{
    id: number;
    status: string;
    order_items?: Array<{ item?: { id?: string }; quantity?: number }>;
  }>;
}

export const Route = createFileRoute("/api/public/jobs/mercadolivre-reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Hardening: throttle por IP antes mesmo da checagem do segredo.
        const limited = enforceRateLimit({ route: "jobs:mercadolivre-reconcile", windowMs: 60_000, max: 12 });
        if (limited) return limited;

        const denied = authorizeJobRequest(request);
        if (denied) return denied;

        const noServiceKey = requireServiceKey("mercadolivre-reconcile");
        if (noServiceKey) return noServiceKey;

        return runJob("mercadolivre-reconcile", async () => {

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { decryptToken } = await import("@/lib/meta-crypto.server");
          const { integrationFetch } = await import("@/lib/http-client.server");
          const { recordDeadLetter } = await import("@/lib/dead-letter.server");

          const { data, error } = await supabaseAdmin
            .from("mercadolivre_integrations")
            .select("company_id, ml_user_id, access_token_encrypted")
            .not("access_token_encrypted", "is", null);
          if (error) {
            return Response.json({ ok: false, error: error.message }, { status: 500 });
          }

          const rows = (data ?? []) as Array<{
            company_id: string;
            ml_user_id: string | null;
            access_token_encrypted: string | null;
          }>;

          const since = new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString();
          let created = 0;
          let scanned = 0;

          for (const row of rows) {
            if (!row.ml_user_id || !row.access_token_encrypted) continue;
            try {
              const token = decryptToken(row.access_token_encrypted);
              const url = new URL(`${ML_API}/orders/search`);
              url.searchParams.set("seller", row.ml_user_id);
              url.searchParams.set("order.status", "paid");
              url.searchParams.set("order.date_created.from", since);
              url.searchParams.set("limit", "50");

              const res = await integrationFetch(
                url,
                { headers: { Authorization: `Bearer ${token}` } },
                { integration: "mercadolivre", timeoutMs: 15_000, maxAttempts: 3 },
              );
              if (!res.ok) {
                throw new Error(`orders/search HTTP ${res.status}`);
              }
              const payload = (await res.json()) as MLSearchResult;

              for (const order of payload.results ?? []) {
                scanned += 1;
                if (order.status !== "paid") continue;
                const referenceNumber = `ML-${order.id}`;
                for (const oi of order.order_items ?? []) {
                  const mlItemId = oi.item?.id;
                  const qty = Number(oi.quantity ?? 0);
                  if (!mlItemId || qty <= 0) continue;

                  const { data: prod } = await supabaseAdmin
                    .from("products")
                    .select("id")
                    .eq("company_id", row.company_id)
                    .eq("ml_item_id", mlItemId)
                    .maybeSingle();
                  const product = prod as { id: string } | null;
                  if (!product) continue;

                  const { error: mvErr } = await supabaseAdmin.from("inventory_movements").insert({
                    company_id: row.company_id,
                    product_id: product.id,
                    type: "out",
                    quantity: qty,
                    reason: "Venda Mercado Livre",
                    notes: `Pedido ML #${order.id} (reconciliação)`,
                    movement_date: new Date().toISOString(),
                    source: "mercadolivre",
                    reference_number: referenceNumber,
                  });
                  if (!mvErr) {
                    created += 1;
                  } else if (
                    (mvErr as { code?: string }).code !== "23505" &&
                    !/duplicate key/i.test(mvErr.message ?? "")
                  ) {
                    throw new Error(mvErr.message);
                  }
                }
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              console.error("[ml-reconcile]", row.company_id, message);
              await recordDeadLetter({
                companyId: row.company_id,
                source: "mercadolivre",
                topic: "reconcile",
                reference: row.company_id,
                payload: { companyId: row.company_id, since },
                errorMessage: message,
              });
            }
          }

          return Response.json({ ok: true, integrations: rows.length, scanned, created });
        });
      },
    },
  },
});
