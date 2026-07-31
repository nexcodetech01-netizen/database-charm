/**
 * Sales v2 — Tipos públicos (Sprint 005).
 *
 * Reutiliza os tipos gerados do Supabase (via `../../types`) e adiciona
 * apenas contratos derivados que não existem hoje. Nenhum novo schema
 * de banco é criado nesta sprint — o v2 opera sobre a estrutura
 * existente (`sales`, `sale_items`, `customers`, `products`).
 */
import type { Sale, SaleItem, SaleStatus } from "../../types";

export type { Sale, SaleItem, SaleStatus, SaleInsert } from "../../types";

/**
 * Status "lógicos" da Sprint 005 mapeados para o enum atual do banco.
 * O mapeamento é INTENCIONALMENTE conservador — nenhuma migração de
 * schema foi aplicada; a UI/Bella conversa em v2, o storage continua v1.
 */
export type SalesOrderStatus =
  | "draft"        // orçamento não confirmado (status DB: draft)
  | "quotation"    // orçamento formal enviado ao cliente (status DB: draft + flag)
  | "approved"     // aprovado, aguardando reserva (status DB: pending)
  | "reserved"     // estoque reservado (status DB: pending)
  | "invoiced"     // faturado (status DB: paid | partially_paid)
  | "cancelled";   // cancelado (status DB: cancelled)

export const V2_TO_DB_STATUS: Record<SalesOrderStatus, SaleStatus> = {
  draft: "draft",
  quotation: "draft",
  approved: "pending",
  reserved: "pending",
  invoiced: "paid",
  cancelled: "cancelled",
};

export function dbStatusToV2(status: SaleStatus | string | null | undefined): SalesOrderStatus {
  switch (status) {
    case "draft":
      return "draft";
    case "pending":
      return "approved";
    case "partially_paid":
    case "paid":
      return "invoiced";
    case "cancelled":
      return "cancelled";
    default:
      return "draft";
  }
}

export interface SaleOrderItemInput {
  productId: string;
  quantity: number;
  unitPrice?: number | null;
  discount?: number | null;
  description?: string | null;
}

export interface CreateSaleOrderInput {
  customerId?: string | null;
  status?: SalesOrderStatus;
  items: SaleOrderItemInput[];
  discount?: number | null;
  shipping?: number | null;
  notes?: string | null;
  saleDate?: string | null;
}

export interface SaleOrderSummary {
  id: string;
  number: string | null;
  customerId: string | null;
  customerName: string | null;
  status: SalesOrderStatus;
  dbStatus: string;
  itemsTotal: number;
  discount: number;
  shipping: number;
  grandTotal: number;
  itemsCount: number;
  saleDate: string | null;
  createdAt: string | null;
}

export interface SaleMarginBreakdown {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  marginPct: number | null;
  itemsCount: number;
}

export interface SaleBestCustomerRow {
  customerId: string;
  customerName: string;
  totalRevenue: number;
  ordersCount: number;
  averageTicket: number;
}

export interface SaleWithItemsV2 extends Sale {
  items: SaleItem[];
  customer_name: string | null;
  v2Status: SalesOrderStatus;
}
