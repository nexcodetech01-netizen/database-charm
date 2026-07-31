/**
 * Sincronização NexOS → Mercado Livre.
 *
 * Chamada em background (fire-and-forget) sempre que:
 *  - `products.price` ou `products.stock` mudam via UI;
 *  - Uma venda muda o estoque disparando `apply_sale_to_inventory`.
 *
 * Faz PUT em https://api.mercadolibre.com/items/{ml_item_id} atualizando
 * `available_quantity` e/ou `price`. É idempotente e silenciosa em erros —
 * problemas de conexão não devem quebrar o fluxo principal (venda, edição
 * de produto). Erros são logados; a UI de integrações reflete o estado
 * expirado via `getIntegrationSummary`.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { integrationFetch } from "@/lib/http-client.server";

const ML_API = "https://api.mercadolibre.com";

export const syncProductToMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string }) => {
    const productId = String(input?.productId ?? "").trim();
    if (!productId) throw new Error("productId obrigatório.");
    return { productId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: product, error: prodErr } = await supabase
      .from("products")
      .select("id, company_id, price, stock, ml_item_id")
      .eq("id", data.productId)
      .maybeSingle();
    if (prodErr) throw prodErr;
    const p = product as {
      id: string;
      company_id: string;
      price: number | null;
      stock: number | null;
      ml_item_id: string | null;
    } | null;
    if (!p?.ml_item_id) return { ok: true, skipped: "no-ml-item" as const };

    // Garante token fresco antes de chamar a API
    const { ensureFreshAccessToken } = await import("./mercadolivre.server");
    await ensureFreshAccessToken(supabase, p.company_id, userId);

    const { data: integ, error: iErr } = await supabase
      .from("mercadolivre_integrations")
      .select("access_token_encrypted, token_expires_at")
      .eq("company_id", p.company_id)
      .maybeSingle();
    if (iErr) throw iErr;
    const enc = (integ as { access_token_encrypted: string | null } | null)
      ?.access_token_encrypted;
    if (!enc) return { ok: false, skipped: "no-token" as const };

    const { decryptToken } = await import("./meta-crypto.server");
    const accessToken = decryptToken(enc);

    const price = p.price != null ? Number(p.price) : null;
    const availableQuantity = Math.max(0, Math.floor(Number(p.stock ?? 0)));
    const patch: Record<string, unknown> = {};
    if (availableQuantity >= 0) patch.available_quantity = availableQuantity;
    if (price != null && price > 0) patch.price = Math.round(price * 100) / 100;
    if (Object.keys(patch).length === 0) {
      return { ok: true, skipped: "nothing-to-sync" as const };
    }

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
      // Não relançamos — chamada é fire-and-forget do lado do cliente.
      // Loga para inspeção via logs de server function.
      console.warn(
        `[mercadolivre-sync] PUT /items/${p.ml_item_id} falhou (${res.status}): ${text.slice(0, 300)}`,
      );
      return { ok: false, status: res.status } as const;
    }
    return { ok: true } as const;
  });
