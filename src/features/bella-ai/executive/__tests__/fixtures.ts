import { describe, expect, it } from "vitest";
import type { ExecutiveSnapshot } from "../types";

const dre = (over: Partial<ExecutiveSnapshot["dre"]> = {}) => ({
  grossRevenue: 100000,
  deductions: 5000,
  netRevenue: 95000,
  cogs: 50000,
  grossProfit: 45000,
  operatingExpenses: 25000,
  operatingResult: 20000,
  financialExpenses: 1000,
  netProfit: 19000,
  depreciation: 1000,
  ebitda: 21000,
  grossMargin: 47.4,
  operatingMargin: 21.1,
  netMargin: 20,
  ebitdaMargin: 22.1,
  ...over,
});

export function makeSnapshot(over: Partial<ExecutiveSnapshot> = {}): ExecutiveSnapshot {
  return {
    companyId: "company-1",
    period: { start: "2026-07-01", end: "2026-07-30", today: "2026-07-30" },
    previousPeriod: { start: "2026-06-01", end: "2026-06-30" },
    dre: dre(),
    previousDre: dre({ grossRevenue: 90000, netProfit: 15000, netMargin: 16.7, operatingExpenses: 22000, cogs: 45000, netRevenue: 86000 }),
    balance: { assets: 300000, liabilities: 120000, equity: 180000 },
    cash: {
      available: 60000,
      receivable: 40000,
      overdueReceivable: 0,
      payable: 30000,
      overduePayable: 0,
    },
    inventory: { value: 80000, items: 120, staleItems: 0 },
    tax: {
      regime: "simples_nacional",
      annex: "I",
      rbt12: 900000,
      monthRevenue: 100000,
      estimatedTax: 8000,
      effectiveRate: 8,
      limitUsagePct: 18.75,
      bracket: 3,
    },
    salesCount: 200,
    rankings: {
      products: [
        { id: "p1", name: "Produto A", sku: "A", stock: 10, quantitySold: 50, revenue: 50000, profit: 20000, margin: 40, turnover: 5 },
        { id: "p2", name: "Produto B", sku: "B", stock: 20, quantitySold: 10, revenue: 20000, profit: -2000, margin: -10, turnover: 0.5 },
        { id: "p3", name: "Produto C", sku: "C", stock: 30, quantitySold: 0, revenue: 0, profit: 0, margin: 0, turnover: 0 },
      ],
      customers: [
        { id: "c1", name: "Cliente 1", salesCount: 10, revenue: 30000, overdueAmount: 0, lastSaleAt: "2026-07-20", averageTicket: 3000 },
        { id: "c2", name: "Cliente 2", salesCount: 1, revenue: 5000, overdueAmount: 2000, lastSaleAt: "2026-07-05", averageTicket: 5000 },
      ],
      suppliers: [
        { id: "s1", name: "Fornecedor 1", purchasesCount: 4, totalAmount: 40000, averageAmount: 10000, deliveryDays: 15 },
        { id: "s2", name: "Fornecedor 2", purchasesCount: 2, totalAmount: 4000, averageAmount: 2000, deliveryDays: 5 },
      ],
    },
    generatedAt: "2026-07-30T12:00:00.000Z",
    ...over,
  };
}

describe("fixtures", () => {
  it("gera um snapshot coerente", () => {
    const s = makeSnapshot();
    expect(s.dre.grossRevenue).toBe(100000);
    expect(s.rankings.products).toHaveLength(3);
  });
});
