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

export const syncProductToMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string }) => {
    const productId = String(input?.productId ?? "").trim();
    if (!productId) throw new Error("productId obrigatório.");
    return { productId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { syncProductToMercadoLivreCore } = await import("@/lib/marketplace-sync.server");
    return syncProductToMercadoLivreCore(supabase, { productId: data.productId, userId });
  });
