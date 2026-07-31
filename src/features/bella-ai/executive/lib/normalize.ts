/**
 * Normalização do payload da RPC `generate_executive_summary`.
 *
 * Nenhum cálculo de negócio acontece aqui — apenas leitura defensiva do
 * JSON devolvido pelos motores existentes (DRE, balanço, KPIs, caixa,
 * estoque, tributos e rankings).
 */

import type {
  ExecutiveDre,
  ExecutiveSnapshot,
  ExecutiveCustomerRow,
  ExecutiveProductRow,
  ExecutiveSupplierRow,
} from "../types";

type Json = Record<string, unknown>;

const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const arr = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);

export const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

export const safeDiv = (a: number, b: number): number => (b === 0 ? 0 : a / b);
export const pctChange = (current: number, previous: number): number => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
};

function toDre(raw: unknown): ExecutiveDre {
  const d = obj(raw);
  return {
    grossRevenue: num(d.grossRevenue ?? d.gross_revenue),
    deductions: num(d.deductions),
    netRevenue: num(d.netRevenue ?? d.net_revenue),
    cogs: num(d.cogs),
    grossProfit: num(d.grossProfit ?? d.gross_profit),
    operatingExpenses: num(d.operatingExpenses ?? d.operating_expenses),
    operatingResult: num(d.operatingResult ?? d.operating_result),
    financialExpenses: num(d.financialExpenses ?? d.financial_expenses),
    netProfit: num(d.netProfit ?? d.net_profit),
    depreciation: num(d.depreciation),
    ebitda: num(d.ebitda),
    grossMargin: num(d.grossMargin ?? d.gross_margin),
    operatingMargin: num(d.operatingMargin ?? d.operating_margin),
    netMargin: num(d.netMargin ?? d.net_margin),
    ebitdaMargin: num(d.ebitdaMargin ?? d.ebitda_margin),
  };
}

function toProducts(raw: unknown): ExecutiveProductRow[] {
  return arr(raw).map((p) => {
    const revenue = num(p.revenue);
    const profit = num(p.profit);
    const stock = num(p.stock);
    const quantitySold = num(p.quantity_sold ?? p.quantitySold);
    return {
      id: String(p.id ?? ""),
      name: String(p.name ?? ""),
      sku: str(p.sku),
      stock,
      quantitySold,
      revenue,
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      turnover: stock > 0 ? quantitySold / stock : quantitySold > 0 ? quantitySold : 0,
    };
  });
}

function toCustomers(raw: unknown): ExecutiveCustomerRow[] {
  return arr(raw).map((c) => {
    const revenue = num(c.revenue);
    const salesCount = num(c.sales_count ?? c.salesCount);
    return {
      id: String(c.id ?? ""),
      name: String(c.name ?? ""),
      salesCount,
      revenue,
      overdueAmount: num(c.overdue_amount ?? c.overdueAmount),
      lastSaleAt: str(c.last_sale_at ?? c.lastSaleAt),
      averageTicket: salesCount > 0 ? revenue / salesCount : 0,
    };
  });
}

function toSuppliers(raw: unknown): ExecutiveSupplierRow[] {
  return arr(raw).map((s) => ({
    id: String(s.id ?? ""),
    name: String(s.name ?? ""),
    purchasesCount: num(s.purchases_count ?? s.purchasesCount),
    totalAmount: num(s.total_amount ?? s.totalAmount),
    averageAmount: num(s.average_amount ?? s.averageAmount),
    deliveryDays: num(s.delivery_days ?? s.deliveryDays),
  }));
}

export function toExecutiveSnapshot(raw: unknown): ExecutiveSnapshot {
  const r = obj(raw);
  const period = obj(r.period);
  const prev = obj(r.previousPeriod);
  const balance = obj(r.balanceSheet);
  const cash = obj(r.cash);
  const inventory = obj(r.inventory);
  const tax = obj(r.tax);
  const computation = obj(tax.computation);
  const rankings = obj(r.rankings);

  return {
    companyId: String(r.companyId ?? ""),
    period: {
      start: String(period.start ?? ""),
      end: String(period.end ?? ""),
      today: String(period.today ?? period.end ?? ""),
    },
    previousPeriod: {
      start: String(prev.start ?? ""),
      end: String(prev.end ?? ""),
    },
    dre: toDre(r.dre),
    previousDre: toDre(r.previousDre),
    balance: {
      assets: num(balance.assets),
      liabilities: num(balance.liabilities),
      equity: num(balance.equity),
    },
    cash: {
      available: num(cash.available),
      receivable: num(cash.receivable),
      overdueReceivable: num(cash.overdueReceivable),
      payable: num(cash.payable),
      overduePayable: num(cash.overduePayable),
    },
    inventory: {
      value: num(inventory.value),
      items: num(inventory.items),
      staleItems: num(inventory.staleItems),
    },
    tax: {
      regime: str(tax.regime),
      annex: str(tax.annex),
      rbt12: num(tax.rbt12),
      monthRevenue: num(tax.monthRevenue),
      estimatedTax: num(computation.taxAmount ?? computation.tax_amount),
      effectiveRate: num(computation.effectiveRate ?? computation.effective_rate),
      limitUsagePct: num(computation.limitUsagePct ?? computation.limit_usage_pct),
      bracket: computation.bracket != null ? num(computation.bracket) : null,
    },
    salesCount: num(r.salesCount),
    rankings: {
      products: toProducts(rankings.products),
      customers: toCustomers(rankings.customers),
      suppliers: toSuppliers(rankings.suppliers),
    },
    generatedAt: String(r.generatedAt ?? new Date().toISOString()),
  };
}
