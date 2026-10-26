/**
 * Grava um evento do catálogo público (visita, peça vista, clique no
 * WhatsApp). Só para coleções ativas; ignora repetição do mesmo visitante
 * na mesma peça em 30 minutos (recarregar a página não infla o número).
 */
import { CATALOG_EVENTS, type CatalogEventType } from "./catalog-events";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEDUPE_MS = 30 * 60_000;

export interface TrackInput {
  slug?: unknown;
  event?: unknown;
  product_id?: unknown;
  visitor_id?: unknown;
  referrer?: unknown;
}

export function parseTrackInput(body: TrackInput) {
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const event: CatalogEventType | undefined = CATALOG_EVENTS.find((e) => e === body.event);
  const productId =
    typeof body.product_id === "string" && UUID.test(body.product_id) ? body.product_id : null;
  const visitorId =
    typeof body.visitor_id === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(body.visitor_id)
      ? body.visitor_id
      : null;
  const referrer =
    typeof body.referrer === "string" && body.referrer ? body.referrer.slice(0, 200) : null;
  if (!slug || slug.length > 120 || !event || !visitorId) return null;
  if (event === "product_view" && !productId) return null;
  return { slug, event, productId, visitorId, referrer };
}

export async function trackCatalogEvent(body: TrackInput): Promise<boolean> {
  const input = parseTrackInput(body);
  if (!input) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  const { data: col } = await db
    .from("product_collections")
    .select("id, company_id, status")
    .eq("slug", input.slug)
    .maybeSingle();
  if (!col || col.status !== "active") return false;

  if (input.productId) {
    const { data: prod } = await db
      .from("products")
      .select("id")
      .eq("id", input.productId)
      .eq("company_id", col.company_id)
      .maybeSingle();
    if (!prod) return false;
  }

  let dup = db
    .from("catalog_events")
    .select("id")
    .eq("visitor_id", input.visitorId)
    .eq("event_type", input.event)
    .gte("created_at", new Date(Date.now() - DEDUPE_MS).toISOString())
    .limit(1);
  dup = input.productId ? dup.eq("product_id", input.productId) : dup.is("product_id", null);
  const { data: existing } = await dup;
  if (existing && existing.length > 0) return true;

  const { error } = await db.from("catalog_events").insert({
    company_id: col.company_id,
    collection_id: col.id,
    product_id: input.productId,
    event_type: input.event,
    visitor_id: input.visitorId,
    referrer: input.referrer,
  });
  return !error;
}
