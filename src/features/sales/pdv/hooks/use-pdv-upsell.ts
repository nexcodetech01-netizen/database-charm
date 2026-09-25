import { useMemo } from "react";
import type { SaleItemDraft } from "../../types";
import { pdvUpsellSuggestions } from "../lib/upsell";
import type { PdvSearchOption } from "../lib/search-cache";

/**
 * Sugestão de venda casada pro último item adicionado ao carrinho —
 * reaproveita o catálogo que o PDV já carrega localmente, sem ida ao
 * servidor nem custo de IA.
 */
export function usePdvUpsell(
  products: readonly PdvSearchOption[],
  items: readonly SaleItemDraft[],
): { forProductId: string | null; suggestions: PdvSearchOption[] } {
  const lastItem = items[items.length - 1] ?? null;
  const cartProductIds = useMemo(
    () => items.map((it) => it.product_id).filter((id): id is string => !!id),
    [items],
  );

  return useMemo(() => {
    const currentProductId = lastItem?.product_id ?? null;
    if (!currentProductId || products.length === 0) {
      return { forProductId: null, suggestions: [] as PdvSearchOption[] };
    }
    return {
      forProductId: currentProductId,
      suggestions: pdvUpsellSuggestions({ products, currentProductId, cartProductIds }),
    };
  }, [products, lastItem?.product_id, cartProductIds]);
}