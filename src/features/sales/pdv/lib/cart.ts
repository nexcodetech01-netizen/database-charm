/**
 * PDV — helpers de carrinho.
 *
 * Contém apenas mapeamento/identidade. Nenhum cálculo monetário vive
 * aqui: subtotal, desconto e total são sempre pedidos ao SaleEngine.
 */
import type { SaleItemDraft } from "../../types";
import type { PDVProductOption } from "../types";

/** Converte um produto da busca em item de carrinho (draft canônico). */
export function toCartItem(
  product: PDVProductOption,
  quantity = 1,
): SaleItemDraft {
  return {
    ui_key: `pdv-${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: product.id,
    description: product.name,
    quantity,
    unit_price: product.price != null ? Number(product.price) : 0,
    discount: 0,
    sku: product.sku ?? null,
    unit: product.unit ?? null,
    unit_cost: product.cost != null ? Number(product.cost) : null,
    stock_available: product.stock != null ? Number(product.stock) : null,
  };
}

/** Localiza um item já presente no carrinho para o mesmo produto. */
export function findCartItemByProduct(
  items: SaleItemDraft[],
  productId: string,
): SaleItemDraft | undefined {
  return items.find((it) => it.product_id === productId);
}

/** Quantidade total de unidades no carrinho (contagem, não valor). */
export function countCartUnits(items: SaleItemDraft[]): number {
  return items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
}

/** Chave do item de carrinho (mesma usada como `key` de renderização). */
export function cartItemKey(item: SaleItemDraft): string {
  return item.ui_key ?? item.product_id ?? item.description;
}

/**
 * Item "ativo" do carrinho — alvo dos atalhos F3 (quantidade) e DELETE.
 *
 * Regra de UX (não de negócio): usa o item selecionado quando ele ainda
 * existe; caso contrário, o último item adicionado.
 */
export function resolveActiveCartKey(
  items: SaleItemDraft[],
  selectedKey?: string | null,
): string | null {
  if (items.length === 0) return null;
  if (selectedKey && items.some((it) => cartItemKey(it) === selectedKey)) {
    return selectedKey;
  }
  return cartItemKey(items[items.length - 1]);
}
