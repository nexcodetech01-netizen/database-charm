import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Purchase = Tables<"purchases">;
export type PurchaseInsert = TablesInsert<"purchases">;
export type PurchaseUpdate = TablesUpdate<"purchases">;

export type PurchaseItem = Tables<"purchase_items">;
export type PurchaseItemInsert = TablesInsert<"purchase_items">;

export type PurchaseStatus = "draft" | "pending" | "received" | "cancelled";

export const PURCHASE_STATUS_OPTIONS: { value: PurchaseStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "pending", label: "Pendente" },
  { value: "received", label: "Recebida" },
  { value: "cancelled", label: "Cancelada" },
];

export const PURCHASE_PAYMENT_TERMS = [
  { value: "a_vista", label: "À vista" },
  { value: "boleto", label: "Boleto" },
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
  { value: "7d", label: "7 dias" },
  { value: "14d", label: "14 dias" },
  { value: "28d", label: "28 dias" },
  { value: "30d", label: "30 dias" },
  { value: "30_60", label: "30/60 dias" },
  { value: "30_60_90", label: "30/60/90 dias" },
];

export interface PurchaseWithMeta extends Purchase {
  supplier_name: string | null;
  items_count: number;
}

export interface PurchaseWithItems extends Purchase {
  supplier_name: string | null;
  items: PurchaseItem[];
}

export type PurchaseSortKey = "purchase_date" | "created_at" | "grand_total" | "number";
export type PurchaseSortDir = "asc" | "desc";

export interface PurchaseListFilters {
  search: string;
  status: string;
  supplierId: string;
  sortBy: PurchaseSortKey;
  sortDir: PurchaseSortDir;
  page: number;
  pageSize: number;
}

export interface PurchaseItemDraft {
  id?: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  // Transient — apenas UX (não persistidos em purchase_items).
  sku?: string | null;
  image_url?: string | null;
  unit?: string | null;
  stock_available?: number | null;
  last_cost?: number | null;
}

export function computeItemTotal(item: {
  quantity: number;
  unit_price: number;
  discount: number;
}): number {
  const gross = (item.quantity || 0) * (item.unit_price || 0);
  return Math.max(0, gross - (item.discount || 0));
}

export function computeTotals(
  items: { quantity: number; unit_price: number; discount: number }[],
  extras: { discount: number; shipping: number; insurance: number; other_costs: number },
) {
  const items_total = items.reduce((sum, it) => sum + computeItemTotal(it), 0);
  const grand_total =
    items_total -
    (extras.discount || 0) +
    (extras.shipping || 0) +
    (extras.insurance || 0) +
    (extras.other_costs || 0);
  return { items_total, grand_total: Math.max(0, grand_total) };
}

/**
 * Métricas de custo: quantidade total (unidades), custo médio unitário
 * considerando rateio de custos extras e desconto sobre o grand_total.
 */
export function computePurchaseCostMetrics(
  items: { quantity: number; unit_price: number; discount: number }[],
  grand_total: number,
) {
  const total_qty = items.reduce((s, it) => s + (it.quantity || 0), 0);
  const avg_unit_cost = total_qty > 0 ? grand_total / total_qty : 0;
  return { total_qty, avg_unit_cost };
}
