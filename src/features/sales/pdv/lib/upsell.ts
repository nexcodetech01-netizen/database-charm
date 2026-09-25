/**
 * PDV — Sugestão de venda casada (produto complementar).
 *
 * Reaproveita o MESMO ranqueador puro e determinístico já usado no bot de
 * WhatsApp (`features/whatsapp/inbound/product-upsell.ts`) — mesma lógica
 * de "combina com", sem IA, sem custo, sem ida ao servidor: usa o catálogo
 * que o PDV já carrega localmente (`usePdvCatalogIndex`).
 */
import { rankUpsell, type UpsellItem } from "@/features/whatsapp/inbound/product-upsell";
import type { PdvSearchOption } from "./search-cache";

function toUpsellItem(p: PdvSearchOption): UpsellItem {
  return {
    id: p.id,
    name: p.name,
    price: p.price ?? 0,
    brand: p.brand ?? null,
    categoryId: null,
    unit: p.unit ?? null,
  };
}

export interface PdvUpsellArgs {
  /** Catálogo já carregado no PDV (usePdvCatalogIndex). */
  products: readonly PdvSearchOption[];
  /** Produto de referência — normalmente o último item adicionado ao carrinho. */
  currentProductId: string;
  /** Produtos já no carrinho — nunca sugeridos de novo. */
  cartProductIds: readonly string[];
  limit?: number;
}

/** Sugestões de venda casada pro produto informado, a partir do catálogo local do PDV. */
export function pdvUpsellSuggestions(args: PdvUpsellArgs): PdvSearchOption[] {
  const current = args.products.find((p) => p.id === args.currentProductId);
  if (!current) return [];

  const ranked = rankUpsell({
    current: toUpsellItem(current),
    candidates: args.products.map(toUpsellItem),
    cartProductIds: args.cartProductIds,
    limit: args.limit,
  });

  const byId = new Map(args.products.map((p) => [p.id, p] as const));
  return ranked.map((r) => byId.get(r.id)).filter((p): p is PdvSearchOption => !!p);
}