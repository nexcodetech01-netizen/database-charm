/**
 * Atualiza o status de um anúncio no Mercado Livre (ativo/pausado)
 * e o estoque (quantidade disponível).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerPermission } from "@/features/rbac/guards/server-guards";
import { integrationFetch } from "@/lib/http-client.server";

const ML_API = "https://api.mercadolibre.com";

async function getAccessToken(supabase: any, companyId: string, userId: string) {
  const { ensureFreshAccessToken } = await import("./mercadolivre.server");
  await ensureFreshAccessToken(supabase, companyId, userId);

  const { data: integ, error: iErr } = await supabase
    .from("mercadolivre_integrations")
    .select("access_token_encrypted")
    .eq("company_id", companyId)
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
  return decryptToken(enc);
}

export const syncProductToMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string }) => {
    const productId = String(input?.productId ?? "").trim();
    if (!productId) throw new Error("productId obrigatório.");
    return { productId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: product, error } = await supabase
      .from("products")
      .select("id, company_id, ml_item_id, stock, price")
      .eq("id", data.productId)
      .maybeSingle();
    
    if (error) throw error;
    if (!product?.ml_item_id) return { ok: true, skipped: "not_published" };

    const token = await getAccessToken(supabase, product.company_id, userId);

    // No payload de sincronização rápida, enviamos apenas preço e estoque.
    // O status (active/paused) é gerido por outra função ou via dashboard.
    const res = await integrationFetch(
      `${ML_API}/items/${product.ml_item_id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          price: Number(product.price),
          available_quantity: Math.max(0, Math.floor(Number(product.stock))),
        }),
      },
      { integration: "mercadolivre:item-sync", timeoutMs: 20_000 },
    );
    
    if (!res.ok) {
      const text = await res.text();
      console.warn(`[ml-sync] falha ao sincronizar produto ${product.id}: ${text}`);
      return { ok: false, error: text };
    }
    
    return { ok: true };
  });

export const updateMercadoLivreItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; status?: "paused" | "active"; quantity?: number; price?: number }) => {
    const productId = String(input?.productId ?? "").trim();
    if (!productId) throw new Error("productId obrigatório.");
    return { ...input, productId };
  })
  .handler(async ({ data, context }) => {
    await requireServerPermission(context, "products.update", {
      action: "mercadolivre.item.update",
      module: "mercadolivre",
    });
    const { supabase, userId } = context;

    const { data: product, error } = await supabase
      .from("products")
      .select("id, company_id, ml_item_id")
      .eq("id", data.productId)
      .maybeSingle();
    
    if (error) throw error;
    if (!product?.ml_item_id) throw new Error("Produto não publicado no Mercado Livre.");

    const token = await getAccessToken(supabase, product.company_id, userId);

    const payload: any = {};
    if (data.status) payload.status = data.status;
    if (data.quantity !== undefined) payload.available_quantity = data.quantity;
    if (data.price !== undefined) payload.price = data.price;

    const res = await integrationFetch(
      `${ML_API}/items/${product.ml_item_id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
      { integration: "mercadolivre:item-update", timeoutMs: 20_000 },
    );
    
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Erro ML (${res.status}): ${text}`);
    }
    
    return { ok: true };
  });
