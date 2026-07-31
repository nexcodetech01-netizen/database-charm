/**
 * Métricas executivas — funções puras, sem IO.
 * Recebem rows já materializadas e devolvem agregados numéricos.
 */
import type {
  ExecutiveMetrics,
  RawCustomerRow,
  RawFinancialRow,
  RawProductRow,
  RawSaleItemRow,
  RawSaleRow,
} from "./types";

const num = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/** true se a venda foi efetivada (não cancelada / não devolvida). */
export function isCompletedSale(s: RawSaleRow): boolean {
  const status = (s.status ?? "").toLowerCase();
  return status !== "cancelled" && status !== "canceled" && status !== "returned";
}

/** Data da venda considerando sale_date > created_at. */
export function saleDate(s: RawSaleRow): Date {
  return new Date(s.sale_date ?? s.created_at);
}

export function sumRevenueBetween(
  sales: readonly RawSaleRow[],
  from: Date,
  to: Date,
): number {
  let total = 0;
  for (const s of sales) {
    if (!isCompletedSale(s)) continue;
    const d = saleDate(s);
    if (d >= from && d < to) total += num(s.grand_total);
  }
  return Math.round(total * 100) / 100;
}

export function countOrdersBetween(
  sales: readonly RawSaleRow[],
  from: Date,
  to: Date,
): number {
  let n = 0;
  for (const s of sales) {
    if (!isCompletedSale(s)) continue;
    const d = saleDate(s);
    if (d >= from && d < to) n++;
  }
  return n;
}

export function salesIdsBetween(
  sales: readonly RawSaleRow[],
  from: Date,
  to: Date,
): Set<string> {
  const ids = new Set<string>();
  for (const s of sales) {
    if (!isCompletedSale(s)) continue;
    const d = saleDate(s);
    if (d >= from && d < to) ids.add(s.id);
  }
  return ids;
}

export function computeProfit(
  items: readonly RawSaleItemRow[],
  saleIds: Set<string>,
): { revenue: number; cost: number; profit: number } {
  let revenue = 0;
  let cost = 0;
  for (const it of items) {
    if (!saleIds.has(it.sale_id)) continue;
    const qty = num(it.quantity);
    revenue += num(it.total) > 0 ? num(it.total) : num(it.unit_price) * qty;
    cost += num(it.unit_cost) * qty;
  }
  return {
    revenue: Math.round(revenue * 100) / 100,
    cost: Math.round(cost * 100) / 100,
    profit: Math.round((revenue - cost) * 100) / 100,
  };
}

export function countProductsSold(
  items: readonly RawSaleItemRow[],
  saleIds: Set<string>,
): number {
  let n = 0;
  for (const it of items) {
    if (!saleIds.has(it.sale_id)) continue;
    n += num(it.quantity);
  }
  return n;
}

export function countNewCustomers(
  customers: readonly RawCustomerRow[],
  from: Date,
  to: Date,
): number {
  let n = 0;
  for (const c of customers) {
    const d = new Date(c.created_at);
    if (d >= from && d < to) n++;
  }
  return n;
}

export function countRecurringCustomersBetween(
  sales: readonly RawSaleRow[],
  from: Date,
  to: Date,
): number {
  const counts = new Map<string, number>();
  for (const s of sales) {
    if (!isCompletedSale(s) || !s.customer_id) continue;
    const d = saleDate(s);
    if (d < from || d >= to) continue;
    counts.set(s.customer_id, (counts.get(s.customer_id) ?? 0) + 1);
  }
  let recurring = 0;
  counts.forEach((c) => {
    if (c > 1) recurring++;
  });
  return recurring;
}

export function countCriticalStock(products: readonly RawProductRow[]): number {
  let n = 0;
  for (const p of products) {
    const stock = num(p.stock);
    const min = num(p.min_stock);
    if (min > 0 && stock <= min) n++;
  }
  return n;
}

export interface BillsSplit {
  overdueCount: number;
  overdueAmount: number;
  upcomingCount: number;
  upcomingAmount: number;
}

export function splitOpenBills(
  bills: readonly RawFinancialRow[],
  now: Date,
): BillsSplit {
  let overdueCount = 0;
  let overdueAmount = 0;
  let upcomingCount = 0;
  let upcomingAmount = 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const b of bills) {
    if ((b.type ?? "").toLowerCase() !== "expense") continue;
    if (b.paid_at) continue;
    if (!b.due_date) continue;
    const due = new Date(b.due_date);
    const amount = num(b.amount);
    if (due < today) {
      overdueCount++;
      overdueAmount += amount;
    } else {
      upcomingCount++;
      upcomingAmount += amount;
    }
  }
  return {
    overdueCount,
    overdueAmount: Math.round(overdueAmount * 100) / 100,
    upcomingCount,
    upcomingAmount: Math.round(upcomingAmount * 100) / 100,
  };
}

export interface BuildMetricsInput {
  now: Date;
  windows: {
    today: [Date, Date];
    week: [Date, Date];
    month: [Date, Date];
  };
  sales: readonly RawSaleRow[];
  itemsMonth: readonly RawSaleItemRow[];
  products: readonly RawProductRow[];
  bills: readonly RawFinancialRow[];
  customers: readonly RawCustomerRow[];
}

export function buildExecutiveMetrics(input: BuildMetricsInput): ExecutiveMetrics {
  const { now, windows, sales, itemsMonth, products, bills, customers } = input;

  const revenue_today = sumRevenueBetween(sales, windows.today[0], windows.today[1]);
  const revenue_week = sumRevenueBetween(sales, windows.week[0], windows.week[1]);
  const revenue_month = sumRevenueBetween(sales, windows.month[0], windows.month[1]);

  const orders_month = countOrdersBetween(sales, windows.month[0], windows.month[1]);
  const monthSaleIds = salesIdsBetween(sales, windows.month[0], windows.month[1]);
  const profitInfo = computeProfit(itemsMonth, monthSaleIds);
  const products_sold_month = countProductsSold(itemsMonth, monthSaleIds);

  const margin_month_pct =
    profitInfo.revenue > 0
      ? Math.round((profitInfo.profit / profitInfo.revenue) * 1000) / 10
      : 0;

  const avg_ticket_month =
    orders_month > 0 ? Math.round((revenue_month / orders_month) * 100) / 100 : 0;

  const new_customers_month = countNewCustomers(
    customers,
    windows.month[0],
    windows.month[1],
  );
  const recurring_customers_month = countRecurringCustomersBetween(
    sales,
    windows.month[0],
    windows.month[1],
  );

  const critical_stock_count = countCriticalStock(products);
  const openBills = splitOpenBills(bills, now);

  return {
    revenue_today,
    revenue_week,
    revenue_month,
    profit_month: profitInfo.profit,
    margin_month_pct,
    avg_ticket_month,
    orders_month,
    new_customers_month,
    recurring_customers_month,
    products_sold_month,
    critical_stock_count,
    overdue_bills_count: openBills.overdueCount,
    overdue_bills_amount: openBills.overdueAmount,
    upcoming_bills_count: openBills.upcomingCount,
    upcoming_bills_amount: openBills.upcomingAmount,
  };
}
