import { supabase } from "@/integrations/supabase/client";
import { purchasesService } from "./purchases.service";
import type { PurchaseItemDraft } from "../types";

/**
 * Transforma a "Sugestão de compra" da Bella (tela de Estoque) em pedidos
 * de compra em RASCUNHO — um por fornecedor do produto. Rascunho não mexe
 * em estoque nem em financeiro: a pessoa revisa quantidades, custos e
 * fornecedor antes de confirmar.
 */

export interface RestockSuggestionInput {
  productId: string;
  name: string;
  quantity: number;
}

export interface RestockProductInfo {
  id: string;
  name: string;
  supplier_id: string | null;
  last_purchase_cost: number | null;
  cost: number | null;
}

export interface RestockDraftGroup {
  supplierId: string | null;
  items: PurchaseItemDraft[];
}

export interface RestockDraftResult {
  purchaseId: string;
  supplierId: string | null;
  itemCount: number;
}

/** Custo do último pedido; sem histórico, o custo cadastrado; senão 0. */
export function restockUnitCost(product: RestockProductInfo | undefined): number {
  const last = Number(product?.last_purchase_cost ?? 0);
  if (last > 0) return last;
  const cost = Number(product?.cost ?? 0);
  return cost > 0 ? cost : 0;
}

/**
 * Agrupa as sugestões pelo fornecedor cadastrado no produto. Produtos sem
 * fornecedor vão para um grupo próprio (supplierId null), sempre por último.
 */
export function groupRestockBySupplier(
  suggestions: readonly RestockSuggestionInput[],
  products: readonly RestockProductInfo[],
): RestockDraftGroup[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const groups = new Map<string | null, PurchaseItemDraft[]>();

  for (const suggestion of suggestions) {
    const quantity = Math.ceil(Number(suggestion.quantity));
    if (!suggestion.productId || !(quantity > 0)) continue;
    const product = byId.get(suggestion.productId);
    const supplierId = product?.supplier_id ?? null;
    const items = groups.get(supplierId) ?? [];
    items.push({
      product_id: suggestion.productId,
      description: product?.name ?? suggestion.name,
      quantity,
      unit_price: restockUnitCost(product),
      discount: 0,
    });
    groups.set(supplierId, items);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => (a === null ? 1 : 0) - (b === null ? 1 : 0))
    .map(([supplierId, items]) => ({ supplierId, items }));
}

function draftNumber(now: Date, index: number, total: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const base =
    `PC-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  // (company_id, number) é único: vários rascunhos no mesmo segundo precisam de sufixo.
  return total > 1 ? `${base}-${index + 1}` : base;
}

export async function createRestockDraftPurchases(
  companyId: string,
  suggestions: readonly RestockSuggestionInput[],
  now: Date = new Date(),
): Promise<RestockDraftResult[]> {
  const ids = [...new Set(suggestions.map((s) => s.productId).filter(Boolean))];
  if (ids.length === 0) throw new Error("Nenhum produto na sugestão de compra.");

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, supplier_id, last_purchase_cost, cost")
    .eq("company_id", companyId)
    .in("id", ids);
  if (error) throw error;

  const groups = groupRestockBySupplier(suggestions, (products ?? []) as RestockProductInfo[]);
  if (groups.length === 0) throw new Error("Nenhum item com quantidade a comprar.");

  const notes =
    `Rascunho gerado pela sugestão de compra da Bella em ${now.toLocaleDateString("pt-BR")}. ` +
    "Revise quantidades, custos e fornecedor antes de confirmar.";

  const results: RestockDraftResult[] = [];
  for (const [index, group] of groups.entries()) {
    const created = await purchasesService.create({
      company_id: companyId,
      supplier_id: group.supplierId,
      status: "draft",
      number: draftNumber(now, index, groups.length),
      notes,
      items: group.items,
    });
    results.push({
      purchaseId: (created as { id: string }).id,
      supplierId: group.supplierId,
      itemCount: group.items.length,
    });
  }
  return results;
}
