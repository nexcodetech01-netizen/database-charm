/**
 * SalesAnalyticsRepository (Sprint 005)
 *
 * Consultas somente-leitura para relatórios/BI consumidos pelas Skills
 * de inteligência (margem, melhor cliente, curva ABC etc.). Nunca
 * escreve — apenas SELECTs com RLS ativa.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import type { SaleBestCustomerRow, SaleMarginBreakdown } from "../types";

export interface MarginFilters {
  saleId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface BestCustomerFilters {
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export class SalesAnalyticsRepository {
  private readonly supabase: SupabaseClient;
  private readonly companyId: string;

  constructor(ctx: ExecutionContext) {
    this.supabase = ctx.supabase;
    this.companyId = ctx.companyId;
  }

  async computeMargin(filters: MarginFilters): Promise<SaleMarginBreakdown> {
    // Estratégia: buscar sale_items (com snapshots de custo/margem) e
    // agregar em JS — RLS garante escopo por empresa via sale_id.
    let q = this.supabase
      .from("sale_items")
      .select(
        "quantity, unit_price, discount, unit_cost, profit_snapshot, sales!inner(id, company_id, status, sale_date)",
      )
      .eq("sales.company_id", this.companyId)
      .neq("sales.status", "cancelled");

    if (filters.saleId) q = q.eq("sale_id", filters.saleId);
    if (filters.dateFrom) q = q.gte("sales.sale_date", filters.dateFrom);
    if (filters.dateTo) q = q.lte("sales.sale_date", filters.dateTo);

    const { data, error } = await q.limit(5000);
    if (error) throw error;

    let revenue = 0;
    let cost = 0;
    let items = 0;
    for (const row of (data ?? []) as Array<{
      quantity: number | null;
      unit_price: number | null;
      discount: number | null;
      unit_cost: number | null;
      profit_snapshot: number | null;
    }>) {
      const qty = Number(row.quantity ?? 0);
      const rev = Math.max(
        0,
        qty * Number(row.unit_price ?? 0) - Number(row.discount ?? 0),
      );
      const c =
        row.unit_cost != null ? Number(row.unit_cost) * qty : 0;
      revenue += rev;
      cost += c;
      items += 1;
    }
    const profit = revenue - cost;
    return {
      totalRevenue: revenue,
      totalCost: cost,
      totalProfit: profit,
      marginPct: revenue > 0 ? (profit / revenue) * 100 : null,
      itemsCount: items,
    };
  }

  async bestCustomers(filters: BestCustomerFilters): Promise<SaleBestCustomerRow[]> {
    const limit = Math.min(50, Math.max(1, filters.limit ?? 10));
    let q = this.supabase
      .from("sales")
      .select("customer_id, grand_total, customers(name)")
      .eq("company_id", this.companyId)
      .neq("status", "cancelled")
      .not("customer_id", "is", null);

    if (filters.dateFrom) q = q.gte("sale_date", filters.dateFrom);
    if (filters.dateTo) q = q.lte("sale_date", filters.dateTo);

    const { data, error } = await q.limit(5000);
    if (error) throw error;

    const acc = new Map<
      string,
      { name: string; revenue: number; orders: number }
    >();
    for (const row of (data ?? []) as Array<{
      customer_id: string | null;
      grand_total: number | null;
      customers: { name: string | null } | { name: string | null }[] | null;
    }>) {
      if (!row.customer_id) continue;
      const cust = Array.isArray(row.customers) ? row.customers[0] : row.customers;
      const name = cust?.name ?? "Cliente";
      const cur = acc.get(row.customer_id) ?? { name, revenue: 0, orders: 0 };
      cur.revenue += Number(row.grand_total ?? 0);
      cur.orders += 1;
      acc.set(row.customer_id, cur);
    }
    return Array.from(acc.entries())
      .map(([customerId, v]) => ({
        customerId,
        customerName: v.name,
        totalRevenue: v.revenue,
        ordersCount: v.orders,
        averageTicket: v.orders > 0 ? v.revenue / v.orders : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
  }
}
