import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Sale = Tables<"sales">;
export type SaleInsert = TablesInsert<"sales">;
export type SaleUpdate = TablesUpdate<"sales">;

export type SaleItem = Tables<"sale_items">;
export type SaleItemInsert = TablesInsert<"sale_items">;

export type SaleStatus =
  | "draft"
  | "pending"
  | "partially_paid"
  | "paid"
  | "cancelled";

export const SALE_STATUS_OPTIONS: { value: SaleStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "pending", label: "Pendente" },
  { value: "partially_paid", label: "Parcialmente paga" },
  { value: "paid", label: "Paga" },
  { value: "cancelled", label: "Cancelada" },
];

export type SalePaymentMethod =
  | "pix"
  | "pix_manual"
  | "credit_card"
  | "debit_card"
  | "cash"
  | "payment_link"
  | "credit"
  | "a_receber"
  // legacy — mantidos apenas para compatibilidade com dados existentes
  | "card"
  | "bella_pay";

export const SALE_PAYMENT_METHODS: {
  value: SalePaymentMethod;
  label: string;
  disabled?: boolean;
  description?: string;
}[] = [
  { value: "pix", label: "PIX (Bella Pay)" },
  { value: "pix_manual", label: "PIX Próprio" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "cash", label: "Dinheiro" },
  { value: "payment_link", label: "Link de pagamento" },
  {
    value: "credit",
    label: "Crediário",
    description: "Venda parcelada em conta do cliente.",
  },
  {
    value: "a_receber",
    label: "A Receber",
    description: "Venda realizada, aguardando pagamento.",
  },
];

export type CheckoutMethod = Exclude<
  SalePaymentMethod,
  "card" | "bella_pay" | "a_receber"
> | "pending_payment";


export interface SaleWithMeta extends Sale {
  customer_name: string | null;
  items_count: number;
  /**
   * Momento real da liquidação financeira (financial_transactions.paid_at).
   * `null` = venda ainda sem baixa registrada. Não confundir com `sale_date`
   * (competência) nem com `sales.paid_at`.
   */
  settlement_paid_at: string | null;
}

export interface SaleWithItems extends Sale {
  customer_name: string | null;
  items: SaleItem[];
  metadata?: Record<string, any> | null;
}


export type SaleSortKey =
  | "sale_date"
  | "created_at"
  | "grand_total"
  | "number"
  | "paid_at";
export type SaleSortDir = "asc" | "desc";

/** Conferência de recebimentos — sempre baseada em financial_transactions.paid_at. */
export type SalePaymentStatusFilter =
  | ""
  | "paid_today"
  | "paid_session"
  | "unpaid";

export const SALE_PAYMENT_STATUS_OPTIONS: {
  value: Exclude<SalePaymentStatusFilter, "">;
  label: string;
}[] = [
  { value: "paid_today", label: "Pagos hoje" },
  { value: "paid_session", label: "Pagos na sessão atual" },
  { value: "unpaid", label: "Pendentes" },
];

export interface SaleListFilters {
  search: string;
  status: string;
  customerId: string;
  paymentMethod: string;
  paymentStatus: SalePaymentStatusFilter;
  sortBy: SaleSortKey;
  sortDir: SaleSortDir;
  page: number;

  pageSize: number;
}

export interface SaleItemDraft {
  /** Identidade estável apenas da UI; nunca é persistida em sale_items. */
  ui_key?: string;
  id?: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  original_unit_price?: number;
  discount: number;
  addition?: number;
  // Transient (não persistidos em sale_items — usados apenas para UX)
  sku?: string | null;
  image_url?: string | null;
  unit_cost?: number | null;
  stock_available?: number | null;
  unit?: string | null;
  /** Piso de margem da categoria — usado para sinalizar descontos abaixo da política. */
  min_margin_pct?: number | null;
  /** Margem alvo da categoria — apenas informativa. */
  target_margin_pct?: number | null;
  /** Desconto padrão da categoria (%) — snapshot da Política Comercial. */
  default_discount_pct?: number | null;
  /** Snapshot de custo (Sprint P0) — congelado no momento da venda. */
  average_cost?: number | null;
  last_purchase_cost?: number | null;
  cost_method?: "average" | "last_purchase" | null;
  /** Observações por item (Sprint 7.2) — persistidas no banco se a coluna existir, ou apenas UX. */
  notes?: string | null;
}



export function computeItemTotal(item: {
  quantity: number;
  unit_price: number;
  discount: number;
  addition?: number;
}): number {
  const gross = (item.quantity || 0) * (item.unit_price || 0);
  return Math.max(0, gross - (item.discount || 0) + (item.addition || 0));
}

/**
 * Métricas de margem por item — usadas pelo PDV para sinalizar descontos
 * que ultrapassam a margem mínima definida na categoria.
 */
export function computeItemMargin(item: SaleItemDraft): {
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number | null;
} {
  const revenue = computeItemTotal(item);
  const qty = item.quantity || 0;
  const unitCost = item.unit_cost != null ? Number(item.unit_cost) : null;
  const cost = unitCost != null ? unitCost * qty : 0;
  const profit = revenue - cost;
  const marginPct =
    unitCost != null && revenue > 0 ? (profit / revenue) * 100 : null;
  return { revenue, cost, profit, marginPct };
}

export function computeTotals(
  items: { quantity: number; unit_price: number; discount: number; addition?: number }[],
  extras: { discount: number; shipping: number },
) {
  const items_total = items.reduce((sum, it) => sum + computeItemTotal(it), 0);
  const grand_total =
    items_total - (extras.discount || 0) + (extras.shipping || 0);
  return { items_total, grand_total: Math.max(0, grand_total) };
}

/**
 * Lucro estimado e margem % da venda.
 * Considera unit_cost quando disponível no draft.
 */
export function computeSaleMetrics(items: SaleItemDraft[]) {
  let revenue = 0;
  let cost = 0;
  let hasCost = false;
  for (const it of items) {
    revenue += computeItemTotal(it);
    if (it.unit_cost != null && it.unit_cost > 0) {
      hasCost = true;
      cost += Number(it.unit_cost) * (it.quantity || 0);
    }
  }
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { revenue, cost, profit, margin, hasCost };
}
