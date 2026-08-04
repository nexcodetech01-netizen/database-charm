/**
 * Processamento (server-only) das notificações do Mercado Livre.
 *
 * Extraído da rota para permitir reprocessamento pela Dead Letter Queue.
 *
 * Validações de segurança aplicadas antes de qualquer efeito colateral:
 *  1. Formato do payload (campos obrigatórios e tipos).
 *  2. Allow-list de `topic`.
 *  3. Allow-list de `resource` (regex por tópico) — impede SSRF via path.
 *  4. Existência da integração para o `user_id` notificado.
 *  5. `application_id` (quando presente) precisa bater com o client_id da
 *     integração da empresa.
 *  6. Confirmação de origem: o recurso é baixado da API oficial do ML com o
 *     access token da empresa e o `seller.id` do pedido precisa ser o mesmo
 *     `user_id` notificado.
 */
import { integrationFetch } from "@/lib/http-client.server";

const ML_API = "https://api.mercadolibre.com";

/** Tópicos aceitos. `orders_v2` é o único com efeito colateral. */
const TOPIC_RESOURCE_PATTERNS: Record<string, RegExp> = {
  orders_v2: /^\/orders\/\d{1,20}$/,
  items: /^\/items\/[A-Z]{3}\d{1,20}$/,
  messages: /^\/messages\/[\w-]{1,64}$/,
  shipments: /^\/shipments\/\d{1,20}$/,
  payments: /^\/(collections|payments)\/\d{1,20}$/,
};

const PROCESSED_TOPICS = new Set(["orders_v2"]);

export interface MLNotification {
  resource?: unknown;
  topic?: unknown;
  user_id?: unknown;
  application_id?: unknown;
}

export interface MLWebhookOutcome {
  status: number;
  body: string;
  /** Quando true, o chamador deve registrar na Dead Letter Queue. */
  deadLetter?: boolean;
  companyId?: string | null;
}

interface MLOrder {
  id: number;
  status: string;
  seller?: { id?: number };
  order_items?: Array<{ item?: { id?: string }; quantity?: number }>;
}

export interface ValidatedNotification {
  topic: string;
  resource: string;
  userId: string;
  applicationId: string | null;
}

/** Valida forma, tópico e resource. Retorna null quando o payload é inválido. */
export function validateMLNotification(notif: MLNotification): ValidatedNotification | null {
  const topic = typeof notif.topic === "string" ? notif.topic : null;
  const resource = typeof notif.resource === "string" ? notif.resource : null;
  const rawUserId = notif.user_id;
  const userId =
    typeof rawUserId === "number" && Number.isInteger(rawUserId) && rawUserId > 0
      ? String(rawUserId)
      : typeof rawUserId === "string" && /^\d{1,20}$/.test(rawUserId)
        ? rawUserId
        : null;

  if (!topic || !resource || !userId) return null;

  const pattern = TOPIC_RESOURCE_PATTERNS[topic];
  if (!pattern) return null;
  if (!pattern.test(resource)) return null;

  const rawAppId = notif.application_id;
  const applicationId =
    typeof rawAppId === "number" && Number.isInteger(rawAppId) && rawAppId > 0
      ? String(rawAppId)
      : typeof rawAppId === "string" && /^\d{1,20}$/.test(rawAppId)
        ? rawAppId
        : null;

  return { topic, resource, userId, applicationId };
}

export async function processMercadoLivreNotification(
  notif: MLNotification,
): Promise<MLWebhookOutcome> {
  const valid = validateMLNotification(notif);
  if (!valid) {
    return { status: 400, body: "invalid payload" };
  }

  if (!PROCESSED_TOPICS.has(valid.topic)) {
    return { status: 200, body: "ignored topic" };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptToken } = await import("@/lib/meta-crypto.server");

  const { data: integ } = await supabaseAdmin
    .from("mercadolivre_integrations")
    .select("company_id, client_id, access_token_encrypted")
    .eq("ml_user_id", valid.userId)
    .maybeSingle();
  const row = integ as {
    company_id: string;
    client_id: string | null;
    access_token_encrypted: string | null;
  } | null;

  if (!row?.access_token_encrypted) {
    return { status: 200, body: "no integration" };
  }

  // application_id do ML == client_id do app OAuth. Se vier e divergir,
  // a notificação não pertence a esta integração.
  if (valid.applicationId && row.client_id && valid.applicationId !== row.client_id) {
    console.warn("[ml-webhook] application_id divergente — descartado");
    return { status: 401, body: "unknown application" };
  }

  const token = decryptToken(row.access_token_encrypted);
  const orderRes = await integrationFetch(
    `${ML_API}${valid.resource}`,
    { headers: { Authorization: `Bearer ${token}` } },
    { integration: "mercadolivre", timeoutMs: 10_000, maxAttempts: 3 },
  );

  if (orderRes.status === 401 || orderRes.status === 403 || orderRes.status === 404) {
    // Origem não confirmada: recurso inexistente ou não pertencente à conta.
    console.warn(`[ml-webhook] origem não confirmada (${orderRes.status})`);
    return { status: 401, body: "origin not verified", companyId: row.company_id };
  }
  if (!orderRes.ok) {
    return {
      status: 200,
      body: "upstream error",
      deadLetter: true,
      companyId: row.company_id,
    };
  }

  const order = (await orderRes.json()) as MLOrder;

  // Confirmação final de origem: o vendedor do pedido é o user_id notificado.
  if (order.seller?.id !== undefined && String(order.seller.id) !== valid.userId) {
    console.warn("[ml-webhook] seller.id difere do user_id notificado — descartado");
    return { status: 401, body: "origin mismatch", companyId: row.company_id };
  }

  // Sprint 1: Persistência em external_orders para importação manual
  const { error: extErr } = await (supabaseAdmin as any).from("external_orders").upsert({
    company_id: row.company_id,
    marketplace: "mercadolivre",
    external_order_id: String(order.id),
    payload: order,
    status: order.status === "paid" ? "pending" : "ignored",
  }, {
    onConflict: "company_id,marketplace,external_order_id"
  });

  if (extErr) {
    console.error("[ml-webhook] falha ao persistir external_order:", extErr.message);
    // Continuamos para não quebrar a idempotência do fluxo atual se ele ainda existir
  }

  // O fluxo original de baixa de estoque automática deve ser mantido
  // APENAS se o pedido estiver pago e não for duplicata.
  if (order.status !== "paid") {
    return { status: 200, body: "persisted (not paid)", companyId: row.company_id };
  }

  const referenceNumber = `ML-${order.id}`;

  for (const oi of order.order_items ?? []) {
    const mlItemId = oi.item?.id;
    const qty = Number(oi.quantity ?? 0);
    if (!mlItemId || qty <= 0) continue;

    const { data: prod } = await supabaseAdmin
      .from("products")
      .select("id, company_id")
      .eq("company_id", row.company_id)
      .eq("ml_item_id", mlItemId)
      .maybeSingle();
    const product = prod as { id: string; company_id: string } | null;
    if (!product) continue;

    const { error: mvErr } = await supabaseAdmin.from("inventory_movements").insert({
      company_id: product.company_id,
      product_id: product.id,
      type: "out",
      quantity: qty,
      reason: "Venda Mercado Livre",
      notes: `Pedido ML #${order.id}`,
      movement_date: new Date().toISOString(),
      source: "mercadolivre",
      reference_number: referenceNumber,
    });

    if (mvErr) {
      const duplicate =
        (mvErr as { code?: string }).code === "23505" || /duplicate key/i.test(mvErr.message ?? "");
      if (duplicate) continue;
      throw new Error(`falha ao registrar movimento do produto ${product.id}: ${mvErr.message}`);
    }
  }

  return { status: 200, body: "ok", companyId: row.company_id };
}
