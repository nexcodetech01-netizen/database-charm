/**
 * Núcleo único de sincronização NexOS → Mercado Livre (server-only).
 *
 * É o ÚNICO lugar que faz PUT em /items/{id}. Tanto a server function
 * `syncProductToMercadoLivre` (chamada pela UI) quanto o job de fila
 * `/api/public/jobs/marketplace-sync` delegam para cá — não existe segundo
 * motor nem segunda persistência.
 *
 * A fila (`public.marketplace_sync_queue`) é alimentada por trigger no
 * `products` (estoque/preço), portanto qualquer fluxo — venda, PDV, compra,
 * cancelamento, devolução, ajuste — enfileira automaticamente sem que o
 * fluxo de negócio saiba da existência do marketplace. Falha de sync nunca
 * afeta a venda.
 */
import { integrationFetch } from "@/lib/http-client.server";

const ML_API = "https://api.mercadolibre.com";

export type MarketplaceSyncOutcome =
  | { ok: true; skipped?: "no-ml-item" | "nothing-to-sync" }
  | {
      ok: false;
      skipped?: "no-token" | "reconnect-required";
      status?: number;
      error?: string;
    };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

/**
 * Sincroniza estoque/preço de um produto com o anúncio do Mercado Livre.
 * Nunca lança por erro do provedor — devolve `{ ok: false }` para que o
 * chamador decida sobre retentativa.
 */
export async function syncProductToMercadoLivreCore(
  db: AnyClient,
  params: { productId: string; userId?: string },
): Promise<MarketplaceSyncOutcome> {
  const { data: product, error: prodErr } = await db
    .from("products")
    .select("id, company_id, price, stock, ml_item_id")
    .eq("id", params.productId)
    .maybeSingle();
  if (prodErr) throw prodErr;

  const p = product as {
    id: string;
    company_id: string;
    price: number | null;
    stock: number | null;
    ml_item_id: string | null;
  } | null;
  if (!p?.ml_item_id) return { ok: true, skipped: "no-ml-item" };

  const { ensureFreshAccessToken } = await import("./mercadolivre.server");
  await ensureFreshAccessToken(db, p.company_id, params.userId ?? "");

  const { data: integ, error: iErr } = await db
    .from("mercadolivre_integrations")
    .select("access_token_encrypted, token_expires_at")
    .eq("company_id", p.company_id)
    .maybeSingle();
  if (iErr) throw iErr;

  const enc = (integ as { access_token_encrypted: string | null } | null)
    ?.access_token_encrypted;
  if (!enc) return { ok: false, skipped: "no-token", error: "sem token do Mercado Livre" };

  const { tryDecryptToken } = await import("./meta-crypto.server");
  const accessToken = tryDecryptToken(enc);
  if (!accessToken) {
    // Token cifrado com outra chave: nada a retentar até reconectar.
    return {
      ok: false,
      skipped: "reconnect-required",
      error: "token do Mercado Livre não decifrável — reconecte a integração",
    };
  }

  const price = p.price != null ? Number(p.price) : null;
  const availableQuantity = Math.max(0, Math.floor(Number(p.stock ?? 0)));
  const status = availableQuantity === 0 ? "paused" : "active";
  
  const patch: Record<string, unknown> = { 
    available_quantity: availableQuantity,
    status: status
  };
  if (price != null && price > 0) patch.price = Math.round(price * 100) / 100;

  const res = await integrationFetch(
    `${ML_API}/items/${p.ml_item_id}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(patch),
    },
    { integration: "mercadolivre:sync-item", timeoutMs: 20_000 },
  );
  const text = await res.text();
  if (!res.ok) {
    console.warn(
      `[marketplace-sync] PUT /items/${p.ml_item_id} falhou (${res.status}): ${text.slice(0, 300)}`,
    );
    return { ok: false, status: res.status, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
  }
  return { ok: true };
}

export const MARKETPLACE_SYNC_MAX_ATTEMPTS = 5;

export interface MarketplaceSyncQueueRow {
  id: string;
  company_id: string;
  product_id: string;
  marketplace: string;
  attempts: number;
}

/** Consome a fila pendente. Devolve o resumo para telemetria do job. */
export async function drainMarketplaceSyncQueue(
  batchSize = 25,
): Promise<{ processed: number; synced: number; failed: number; skipped: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as AnyClient;

  const { data, error } = await db
    .from("marketplace_sync_queue")
    .select("id, company_id, product_id, marketplace, attempts")
    .eq("status", "pending")
    .eq("marketplace", "mercadolivre")
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as MarketplaceSyncQueueRow[];
  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    await db
      .from("marketplace_sync_queue")
      .update({ status: "processing", last_attempt_at: new Date().toISOString() })
      .eq("id", row.id);

    try {
      const outcome = await syncProductToMercadoLivreCore(db, { productId: row.product_id });
      if (outcome.ok) {
        if (outcome.skipped) skipped += 1;
        else synced += 1;
        await db
          .from("marketplace_sync_queue")
          .update({
            status: "done",
            processed_at: new Date().toISOString(),
            attempts: row.attempts + 1,
            last_error: null,
          })
          .eq("id", row.id);
        continue;
      }
      // Integração desconectada/reconexão pendente: não queima tentativas
      // nem alimenta a DLQ — o item volta para `pending` intacto.
      if (outcome.skipped === "no-token" || outcome.skipped === "reconnect-required") {
        skipped += 1;
        await db
          .from("marketplace_sync_queue")
          .update({ status: "pending", last_error: outcome.error ?? null })
          .eq("id", row.id);
        continue;
      }
      throw new Error(outcome.error ?? "falha desconhecida na sincronização");
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      const attempts = row.attempts + 1;
      const exhausted = attempts >= MARKETPLACE_SYNC_MAX_ATTEMPTS;
      await db
        .from("marketplace_sync_queue")
        .update({
          // Enquanto houver tentativas restantes o item volta para `pending`
          // e será reprocessado na próxima execução do job.
          status: exhausted ? "error" : "pending",
          attempts,
          last_error: message.slice(0, 2000),
        })
        .eq("id", row.id);

      if (exhausted) {
        try {
          const { recordDeadLetter } = await import("@/lib/dead-letter.server");
          await recordDeadLetter({
            companyId: row.company_id,
            source: "mercadolivre",
            topic: "marketplace_sync",
            reference: row.product_id,
            payload: { productId: row.product_id, queueId: row.id },
            errorMessage: message,
          });
        } catch {
          /* telemetria nunca derruba o job */
        }
      }
    }
  }

  return { processed: rows.length, synced, failed, skipped };
}
