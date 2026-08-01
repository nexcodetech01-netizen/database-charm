import { describe, expect, it } from "vitest";
import type { AccountingAiServices } from "../services/ports";
import {
  cashFlowProvider,
  cashProvider,
  customersProvider,
  expensesProvider,
  healthProvider,
  inventoryProvider,
  marginProvider,
  payrollProvider,
  productsProvider,
  profitProvider,
  revenueProvider,
  taxesProvider,
  ticketProvider,
} from "../providers";
import { buildAccountingSummary } from "../providers/summary";
import { makeTestFiscalPort } from "./fixtures";

const period = { start: "2026-01-01", end: "2026-01-31", label: "01/2026" };

const dre = {
  period: { start: period.start, end: period.end },
  grossRevenue: 12000,
  deductions: 1000,
  netRevenue: 11000,
  cogs: 4000,
  grossProfit: 7000,
  operatingExpenses: 3000,
  operatingResult: 4000,
  financialExpenses: 500,
  otherRevenues: 0,
  otherExpenses: 200,
  resultBeforeTaxes: 3300,
  netProfit: 3000,
  depreciation: 100,
  ebitda: 4100,
  grossMargin: 63.6,
  operatingMargin: 36.4,
  netMargin: 27.3,
  ebitdaMargin: 37.3,
  lines: [],
};

const kpis = {
  period: { start: period.start, end: period.end },
  currentLiquidity: 1.8,
  workingCapital: 8000,
  debtRatio: 30,
  grossMargin: 63.6,
  operatingMargin: 36.4,
  netMargin: 27.3,
  ebitda: 4100,
  ebitdaMargin: 37.3,
  roi: 12,
  roe: 15,
  averageTicket: 250,
  salesCount: 44,
  cogsRatio: 36,
  expenseRatio: 27,
  breakEven: 9000,
};

function makeServices(overrides: Partial<AccountingAiServices> = {}): AccountingAiServices {
  return {
    accounting: {
      dre: async () => dre,
      balanceSheet: async () => ({
        asOf: period.end,
        assets: 20000,
        liabilities: 8000,
        equity: 12000,
        equityCapital: 9000,
        periodResult: 3000,
        balanced: true,
        difference: 0,
        lines: [],
      }),
      kpis: async () => kpis,
      monthlyEvolution: async () => [{ label: "01/2026", dre }],
    },
    finance: {
      snapshot: async () => ({
        overview: {
          currentBalance: 5000,
          receivable: 3000,
          receivableOverdue: 400,
          receivableDue30: 2000,
          receivableDue60Plus: 600,
          payable: 1500,
          projected: 6500,
          monthIncome: 9000,
          monthExpense: 4000,
          receiptsToday: 300,
          receiptsTodayCount: 2,
          pendingReceivable: 2600,
          pendingReceivableCount: 5,
          upcomingIncome: [],
          upcomingExpense: [],
        },
        overdueCount: 1,
        overdueAmount: 400,
        forecast30d: { incoming: 2000, outgoing: 900, net: 1100 },
        hasData: true,
      }),
    },
    sales: {
      metrics: async () => ({
        monthTotal: 11000,
        monthCount: 44,
        averageTicket: 250,
        paidTotal: 11000,
        dayTotal: 800,
        dayCount: 3,
      }),
      products: async () => ({
        bestSellers: [{ id: "p1", name: "Produto A", sku: "A", quantity: 10, revenue: 1000 }],
        worstSellers: [{ id: "p8", name: "Produto Y", sku: "Y", quantity: 1, revenue: 20 }],
        noMovement: [{ id: "p9", name: "Produto Z", sku: "Z", stock: 3 }],
      }),
      customers: async () => ({
        metrics: { total: 50, active: 20, newInRange: 5, recurring: 8, inactive: 30 },
        daily: [],
        topCustomers: [{ id: "c1", name: "Cliente A", purchases: 4, revenue: 2000 }],
      }),
    },
    inventory: {
      metrics: async () => ({
        productCount: 30,
        totalItems: 500,
        inventoryValue: 25000,
        belowMin: [{ id: "p2", name: "Produto B", sku: "B", stock: 1, min_stock: 5 }],
        stagnant: [{ id: "p3", name: "Produto C", sku: "C", stock: 7 }],
      }),
    },
    fiscal: makeTestFiscalPort(),
    cash: {
      listSessions: async () => [{ status: "open" }, { status: "closed" }],
    },
    ...overrides,
  };
}

const deps = () => ({ services: makeServices(), period });

describe("accounting-ai · providers", () => {
  it("revenue reflete o DRE sem recalcular", async () => {
    const r = await revenueProvider("c1", deps());
    expect(r.available).toBe(true);
    expect(r.data?.netRevenue).toBe(11000);
    expect(r.source).toBe("accounting");
  });

  it("profit expõe margens do motor contábil", async () => {
    const r = await profitProvider("c1", deps());
    expect(r.data?.netProfit).toBe(3000);
    expect(r.data?.ebitda).toBe(4100);
  });

  it("expenses soma apenas linhas já apuradas", async () => {
    const r = await expensesProvider("c1", deps());
    expect(r.data?.totalExpenses).toBe(4000 + 3000 + 500 + 200);
    expect(r.data?.expenseRatio).toBe(27);
  });

  it("cash combina financeiro e sessões abertas", async () => {
    const r = await cashProvider("c1", deps());
    expect(r.data?.currentBalance).toBe(5000);
    expect(r.data?.openSessions).toBe(1);
  });

  it("cashFlow projeta saldo com previsão de 30 dias", async () => {
    const r = await cashFlowProvider("c1", deps());
    expect(r.data?.net).toBe(1100);
    expect(r.data?.projectedBalance).toBe(6100);
    expect(r.data?.monthly).toHaveLength(1);
  });

  it("taxes cai para receita mensal quando não há apuração", async () => {
    const r = await taxesProvider("c1", deps());
    expect(r.data?.competence).toBe("2026-01");
    expect(r.data?.revenue).toBe(11000);
    expect(r.data?.taxAmount).toBe(0);
  });

  it("inventory devolve contagens do serviço de estoque", async () => {
    const r = await inventoryProvider("c1", deps());
    expect(r.data?.inventoryValue).toBe(25000);
    expect(r.data?.belowMinCount).toBe(1);
  });

  it("ticket usa métricas de vendas", async () => {
    const r = await ticketProvider("c1", deps());
    expect(r.data?.averageTicket).toBe(250);
    expect(r.data?.salesCount).toBe(44);
  });

  it("margin repassa KPIs", async () => {
    const r = await marginProvider("c1", deps());
    expect(r.data?.breakEven).toBe(9000);
  });

  it("products une campeões, sem giro e mínimo", async () => {
    const r = await productsProvider("c1", deps());
    expect(r.data?.bestSellers[0]?.name).toBe("Produto A");
    expect(r.data?.stagnant[0]?.id).toBe("p9");
    expect(r.data?.lowStock).toHaveLength(1);
  });

  it("customers repassa relatório de clientes", async () => {
    const r = await customersProvider("c1", deps());
    expect(r.data?.active).toBe(20);
    expect(r.data?.topCustomers).toHaveLength(1);
  });

  it("payroll sugere sobre o lucro apurado", async () => {
    const r = await payrollProvider("c1", deps());
    expect(r.data?.suggestedAmount).toBeCloseTo(900);
    expect(r.data?.reserveAmount).toBeCloseTo(600);
  });

  it("health consolida diagnóstico", async () => {
    const r = await healthProvider("c1", deps());
    expect(r.data?.level).toBe("healthy");
    expect(r.data?.highlights.length).toBeGreaterThan(0);
  });

  it("provider degrada quando o serviço falha", async () => {
    const services = makeServices({
      accounting: {
        ...makeServices().accounting,
        dre: async () => {
          throw new Error("offline");
        },
      },
    });
    const r = await revenueProvider("c1", { services, period });
    expect(r.available).toBe(false);
    expect(r.data).toBeNull();
  });

  it("summary agrega todos os blocos", async () => {
    const summary = await buildAccountingSummary("c1", deps());
    expect(summary.companyId).toBe("c1");
    expect(summary.period.start).toBe(period.start);
    expect(summary.revenue.available).toBe(true);
    expect(summary.health.available).toBe(true);
    expect(Object.keys(summary)).toContain("payroll");
  });
});
