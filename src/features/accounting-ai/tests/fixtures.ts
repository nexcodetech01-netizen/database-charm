/**
 * Fixtures compartilhadas dos testes da Bella Contadora.
 * Serviços falsos com o mesmo shape das portas (nenhum acesso a rede).
 */
import { computeSimples } from "@/features/tax";
import type { CompanyTaxProfile, TaxApportionment } from "@/features/tax";
import type {
  AccountingAiServices,
  AuditCashSessionRow,
  AuditCustomerRow,
  AuditFiscalDefaults,
  AuditFiscalDocumentRow,
  AuditPort,
  AuditProductRow,
  AuditSaleRow,
  AuditStagnantProductRow,
  AuditTransactionRow,
  FiscalPort,
} from "../services/ports";
import { createExplanationPort } from "../services/adapters";
import { buildAccountingSummary } from "../providers/summary";
import type { AccountingSummary } from "../types";

export const testPeriod = { start: "2026-01-01", end: "2026-01-31", label: "01/2026" };
export const testToday = "2026-01-20";

export const testTaxProfile: CompanyTaxProfile = {
  id: "tp1",
  companyId: "c1",
  taxRegime: "simples_nacional",
  simplesAnnex: "I",
  rbt12: 1_200_000,
  effectiveRate: 8.825,
  nominalRate: 10.7,
  icmsRegime: "simples",
  pisRegime: "simples",
  cofinsRegime: "simples",
  issRegime: "nao_aplicavel",
  ipiRegime: "nao_aplicavel",
  dueDay: 20,
  startDate: "2024-01-01",
  active: true,
};

export interface FiscalPortOptions {
  profile?: CompanyTaxProfile | null;
  rbt12?: number;
  monthlyRevenue?: number;
  apportionment?: TaxApportionment | null;
  apportionments?: TaxApportionment[];
}

/**
 * Porta fiscal falsa. Os números do Simples vêm de `computeSimples`
 * (motor oficial), nunca de fórmulas escritas nos testes.
 */
export function makeTestFiscalPort(options: FiscalPortOptions = {}): FiscalPort {
  const rbt12 = options.rbt12 ?? 1_200_000;
  const revenue = options.monthlyRevenue ?? 11000;
  return {
    monthlyRevenue: async () => revenue,
    apportionments: async () => options.apportionments ?? [],
    profile: async () =>
      options.profile === undefined ? testTaxProfile : options.profile,
    rbt12: async () => rbt12,
    apportionment: async () => options.apportionment ?? null,
    simulateSimples: async (annex, r12, rev) => computeSimples(annex, r12, rev),
    projectScenarios: async (_companyId, competence, growths = [0, 10, 20, 30]) => ({
      competence,
      baseRevenue: revenue,
      rbt12,
      scenarios: growths.map((growthPct) => {
        const projected = revenue * (1 + growthPct / 100);
        const c = computeSimples("I", rbt12 + (projected - revenue), projected);
        return {
          growthPct,
          revenue: projected,
          taxAmount: c.taxAmount,
          effectiveRate: c.effectiveRate,
          bracket: c.bracket,
          cogs: projected * 0.35,
          operatingExpenses: 3000,
          netProfit: projected - projected * 0.35 - 3000 - c.taxAmount,
          netMargin: 0,
        };
      }),
    }),
  };
}

export interface AuditPortOptions {
  transactions?: AuditTransactionRow[];
  sales?: AuditSaleRow[];
  cashSessions?: AuditCashSessionRow[];
  products?: AuditProductRow[];
  customers?: AuditCustomerRow[];
  fiscalDocuments?: AuditFiscalDocumentRow[];
  fiscalDefaults?: AuditFiscalDefaults | null;
  stagnant?: AuditStagnantProductRow[];
  /** Faz a leitura de auditoria falhar (teste de degradação). */
  fail?: boolean;
}

/** Produto saudável usado como base nos testes de auditoria. */
export function makeAuditProduct(patch: Partial<AuditProductRow> = {}): AuditProductRow {
  return {
    id: "p1",
    name: "Produto A",
    sku: "A",
    status: "active",
    stock: 10,
    minStock: 2,
    cost: 5,
    price: 12,
    unit: "un",
    ncm: "61091000",
    categoryId: "cat1",
    marketplaceId: null,
    ...patch,
  };
}

export function makeAuditCustomer(patch: Partial<AuditCustomerRow> = {}): AuditCustomerRow {
  return {
    id: "c1",
    name: "Cliente A",
    document: "39053344705",
    phone: "11999990000",
    whatsapp: null,
    status: "active",
    ...patch,
  };
}

export function makeAuditTransaction(
  patch: Partial<AuditTransactionRow> = {},
): AuditTransactionRow {
  return {
    id: "t1",
    type: "income",
    status: "paid",
    amount: 100,
    description: "Venda 1",
    dueDate: "2026-01-10",
    transactionDate: "2026-01-10",
    paidAt: "2026-01-10",
    referenceId: "s1",
    referenceNumber: "1",
    source: "sale",
    ...patch,
  };
}

export function makeAuditSale(patch: Partial<AuditSaleRow> = {}): AuditSaleRow {
  return {
    id: "s1",
    number: "1",
    status: "paid",
    total: 100,
    saleDate: "2026-01-10",
    customerId: "c1",
    paidAt: "2026-01-10",
    settledAt: "2026-01-10",
    ...patch,
  };
}

export function makeAuditCashSession(
  patch: Partial<AuditCashSessionRow> = {},
): AuditCashSessionRow {
  return {
    id: "sess-0001",
    status: "closed",
    openedAt: "2026-01-20T09:00:00.000Z",
    closedAt: "2026-01-20T18:00:00.000Z",
    expectedCash: 500,
    countedCash: 500,
    difference: 0,
    ...patch,
  };
}

/** Porta de auditoria falsa — empresa saudável por padrão. */
export function makeTestAuditPort(options: AuditPortOptions = {}): AuditPort {
  const boom = async () => {
    throw new Error("serviço indisponível");
  };
  if (options.fail) {
    return {
      transactions: boom,
      sales: boom,
      cashSessions: boom,
      products: boom,
      customers: boom,
      fiscalDocuments: boom,
      fiscalDefaults: boom,
      stagnantProducts: boom,
      purchases: boom,
      suppliers: boom,
    } as unknown as AuditPort;
  }
  return {
    transactions: async () =>
      options.transactions ?? [
        makeAuditTransaction(),
        makeAuditTransaction({
          id: "t2",
          type: "expense",
          description: "Pró-labore janeiro",
          amount: 3000,
          referenceId: null,
        }),
      ],
    sales: async () => options.sales ?? [makeAuditSale()],
    cashSessions: async () => options.cashSessions ?? [makeAuditCashSession()],
    products: async () => options.products ?? [makeAuditProduct()],
    customers: async () => options.customers ?? [makeAuditCustomer()],
    fiscalDocuments: async () => options.fiscalDocuments ?? [],
    fiscalDefaults: async () =>
      options.fiscalDefaults === undefined
        ? { defaultCst: "102" }
        : options.fiscalDefaults,
    stagnantProducts: async () => options.stagnant ?? [],
    purchases: async () => [],
    suppliers: async () => [],
  };
}

export const testDre = {
  period: { start: testPeriod.start, end: testPeriod.end },
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

export const testKpis = {
  period: { start: testPeriod.start, end: testPeriod.end },
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

export interface FixtureOptions {
  /** Faz o serviço financeiro falhar (teste de falha parcial). */
  breakFinance?: boolean;
  /** Remove o histórico do mês anterior. */
  noHistory?: boolean;
  /** Receita paga do dia anterior. */
  yesterdayTotal?: number;
  /** Overrides da porta de auditoria (Sprint 7.2). */
  audit?: AuditPortOptions;
}

export function makeTestServices(opts: FixtureOptions = {}): AccountingAiServices {
  const base: Omit<AccountingAiServices, "explanation"> = {
    accounting: {
      dre: async (_companyId, period) => {
        if (period.start !== testPeriod.start) {
          if (opts.noHistory) throw new Error("sem histórico");
          return { ...testDre, netRevenue: 8000, netProfit: 2000 };
        }
        return testDre;
      },
      balanceSheet: async () => ({
        asOf: testPeriod.end,
        assets: 20000,
        liabilities: 8000,
        equity: 12000,
        equityCapital: 9000,
        periodResult: 3000,
        balanced: true,
        difference: 0,
        lines: [],
      }),
      kpis: async () => testKpis,
      monthlyEvolution: async () => [{ label: "01/2026", dre: testDre }],
    },
    finance: {
      snapshot: async () => {
        if (opts.breakFinance) throw new Error("financeiro indisponível");
        return {
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
            grossRevenue: 9000,
            taxesAndDeductions: 500,
            monthProfit: 5000,
          },
          overdueCount: 1,
          overdueAmount: 400,
          forecast30d: { incoming: 2000, outgoing: 900, net: 1100 },
          hasData: true,
        };
      },
    },
    sales: {
      metrics: async (_companyId, period) => {
        const isYesterday = period.start === "2026-01-19";
        return {
          monthTotal: 11000,
          monthCount: 44,
          averageTicket: 250,
          paidTotal: isYesterday ? (opts.yesterdayTotal ?? 500) : 11000,
          dayTotal: 800,
          dayCount: 3,
        };
      },
      products: async () => ({
        bestSellers: [{ id: "p1", name: "Produto A", sku: "A", quantity: 10, revenue: 1000 }],
        worstSellers: [{ id: "p8", name: "Produto Y", sku: "Y", quantity: 1, revenue: 20 }],
        noMovement: [{ id: "p9", name: "Produto Z", sku: "Z", stock: 3 }],
      }),
      customers: async () => ({
        metrics: { total: 50, active: 20, newInRange: 5, recurring: 8, inactive: 30 },
        daily: [],
        topCustomers: [
          { id: "c1", name: "Cliente A", purchases: 4, revenue: 2000 },
          { id: "c2", name: "Cliente B", purchases: 9, revenue: 1200 },
        ],
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
      ledgerAudit: async () => [],
    },
    fiscal: makeTestFiscalPort(),
    cash: {
      listSessions: async () => [{ status: "open" }, { status: "closed" }],
    },
    audit: makeTestAuditPort(opts.audit),
  };
  return { ...base, explanation: createExplanationPort(base) };
}

export function makeSummary(opts: FixtureOptions = {}): Promise<AccountingSummary> {
  return buildAccountingSummary("c1", {
    services: makeTestServices(opts),
    period: testPeriod,
    today: testToday,
  });
}
