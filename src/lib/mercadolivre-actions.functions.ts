/**
 * Ações de gestão de anúncios no Mercado Livre (NexOS → ML).
 *
 * - `setMercadoLivreItemStatus`: PUT em /items/{id} alterando status
 *   ('paused' | 'active'). Mantém o vínculo local.
 * - `unlinkMercadoLivreItem`: zera `ml_item_id`, `ml_permalink` e
 *   `ml_published_at` no NexOS (não altera nada no ML — útil quando o
 *   anúncio foi removido/moderado e o operador precisa republicar).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerPermission } from "@/features/rbac/guards/server-guards";
import { integrationFetch } from "@/lib/http-client.server";

const ML_API = "https://api.mercadolibre.com";

async function loadProductAndToken(
  supabase: ReturnType<typeof requireSupabaseAuth extends never ? never : never> extends never
    ? any // eslint-disable-line @typescript-eslint/no-explicit-any
    : never,
  productId: string,
  userId: string,
) {
  const { data: product, error } = await supabase
    .from("products")
    .select("id, company_id, ml_item_id")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw error;
  const p = product as {
    id: string;
    company_id: string;
    ml_item_id: string | null;
  } | null;
  if (!p) throw new Error("Produto não encontrado.");
  if (!p.ml_item_id) throw new Error("Este produto não está publicado no Mercado Livre.");

  const { ensureFreshAccessToken } = await import("./mercadolivre.server");
  await ensureFreshAccessToken(supabase, p.company_id, userId);

  const { data: integ, error: iErr } = await supabase
    .from("mercadolivre_integrations")
    .select("access_token_encrypted")
    .eq("company_id", p.company_id)
    .maybeSingle();
  if (iErr) throw iErr;
  const enc = (integ as { access_token_encrypted: string | null } | null)
    ?.access_token_encrypted;
  if (!enc) {
    throw new Error(
      "Integração Mercado Livre desconectada. Reautorize em Configurações → Integrações.",
    );
  }
  const { decryptToken } = await import("./meta-crypto.server");
  return { product: p, accessToken: decryptToken(enc) };
}

export const setMercadoLivreItemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; status: "paused" | "active" }) => {
    const productId = String(input?.productId ?? "").trim();
    const status = input?.status;
    if (!productId) throw new Error("productId obrigatório.");
    if (status !== "paused" && status !== "active") {
      throw new Error("status inválido (use 'paused' ou 'active').");
    }
    return { productId, status };
  })
  .handler(async ({ data, context }) => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "products.update", {
      action: "mercadolivre.item.status",
      module: "mercadolivre",
    });
    const { supabase, userId } = context;
    const { product, accessToken } = await loadProductAndToken(
      supabase as never,
      data.productId,
      userId,
    );

    const res = await integrationFetch(
      `${ML_API}/items/${product.ml_item_id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ status: data.status }),
      },
      { integration: "mercadolivre:item-status", timeoutMs: 20_000 },
    );
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Mercado Livre recusou a alteração (${res.status}): ${text.slice(0, 300)}`,
      );
    }
    return { ok: true, status: data.status } as const;
  });

export const unlinkMercadoLivreItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string }) => {
    const productId = String(input?.productId ?? "").trim();
    if (!productId) throw new Error("productId obrigatório.");
    return { productId };
  })
  .handler(async ({ data, context }) => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "products.update", {
      action: "mercadolivre.item.unlink",
      module: "mercadolivre",
    });
    const { supabase } = context;
    const { data: product, error } = await supabase
      .from("products")
      .select("id, ml_item_id")
      .eq("id", data.productId)
      .maybeSingle();
    if (error) throw error;
    if (!product) throw new Error("Produto não encontrado.");

    const { error: upErr } = await supabase
      .from("products")
      .update({
        ml_item_id: null,
        ml_permalink: null,
        ml_published_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.productId);
    if (upErr) throw upErr;

    return { ok: true } as const;
  });
