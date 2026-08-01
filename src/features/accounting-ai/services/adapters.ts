/**
 * Bella Contadora — adaptadores das portas para os serviços reais do NexOS.
 *
 * Cada método é um *delegate* fino. É proibido adicionar cálculo de negócio
 * aqui: se o número não existe em um serviço, ele não existe para a Bella.
 */
import { accountingService, lastNMonths } from "@/features/accounting";
import { financeQueryService } from "@/features/finance";
import { salesService } from "@/features/sales/services/sales.service";
import { reportsService } from "@/features/reports/services/reports.service";
import { inventoryService } from "@/features/inventory";
import { taxService, toCompetence } from "@/features/tax";
import { cashService } from "@/features/cash";
import type { AccountingPeriod } from "../types";
import { productsService } from "@/features/products/services/products.service";
import { customersService } from "@/features/customers/services/customers.service";
import { financeService } from "@/features/finance/services/finance.service";
import { listFiscalDocuments } from "@/features/fiscal/v2";
import { getFiscalSettings } from "@/features/fiscal/v2/functions/fiscal.functions";
import type {
  AccountingAiServices,
  AccountingPort,
  AuditPort,
  CashPort,
  ExplanationPort,
  FinancePort,
  FiscalPort,
  InventoryPort,
  SalesPort,
} from "./ports";

const toRange = (period: AccountingPeriod) =>
  ({ from: period.start, to: period.end, preset: "custom" }) as const;

export const accountingAdapter: AccountingPort = {
  dre: (companyId, period) => accountingService.dre(companyId, period.start, period.end),
  balanceSheet: (companyId, asOf) => accountingService.balanceSheet(companyId, asOf),
  kpis: (companyId, period) => accountingService.kpis(companyId, period.start, period.end),
  monthlyEvolution: (companyId, months) =>
    accountingService.monthlyEvolution(companyId, lastNMonths(months)),
};

export const financeAdapter: FinancePort = {
  snapshot: (companyId) => financeQueryService.snapshot(companyId),
};

export const salesAdapter: SalesPort = {
  async metrics(companyId, period) {
    const m = await salesService.metrics(companyId, {
      from: period.start,
      to: period.end,
    });
    return {
      monthTotal: m.monthTotal,
      monthCount: m.monthCount,
      averageTicket: m.averageTicket,
      paidTotal: m.paidTotal,
      dayTotal: m.dayTotal,
      dayCount: m.dayCount,
    };
  },
  products: (companyId, period) => reportsService.products(companyId, toRange(period)),
  customers: (companyId, period) => reportsService.customers(companyId, toRange(period)),
};

export const inventoryAdapter: InventoryPort = {
  metrics: (companyId) => inventoryService.metrics(companyId),
};

export const fiscalAdapter: FiscalPort = {
  monthlyRevenue: (companyId, competence) =>
    taxService.monthlyRevenue(companyId, competence || toCompetence()),
  apportionments: (companyId, limit) => taxService.listApportionments(companyId, limit),
  profile: (companyId) => taxService.getProfile(companyId),
  rbt12: (companyId, competence) =>
    taxService.rbt12(companyId, competence || toCompetence()),
  apportionment: (companyId, competence) =>
    taxService.getApportionment(companyId, competence || toCompetence()),
  simulateSimples: (annex, rbt12, revenue) =>
    taxService.simulateSimples(annex, rbt12, revenue),
  projectScenarios: (companyId, competence, growths) =>
    taxService.projectScenarios(companyId, competence || toCompetence(), growths),
};

export const cashAdapter: CashPort = {
  async listSessions(companyId, limit) {
    const sessions = await cashService.listSessions(companyId, limit ?? 10);
    return (sessions ?? []).map((s) => ({ status: String(s.status ?? "") }));
  },
};

/**
 * Sprint 7.2 — porta de auditoria. Cada método é um *delegate* de leitura
 * sobre serviços oficiais. É proibido gravar, corrigir ou recalcular.
 */
export const auditAdapter: AuditPort = {
  async transactions(companyId, limit = 300) {
    const { rows } = await financeService.listTransactions(companyId, {
      search: "",
      type: "",
      status: "",
      accountId: "",
      categoryId: "",
      page: 1,
      pageSize: limit,
    });
    return rows.map((t) => ({
      id: t.id,
      type: String(t.type ?? ""),
      status: String(t.status ?? ""),
      amount: Number(t.amount ?? 0),
      description: String(t.description ?? ""),
      dueDate: t.due_date ?? null,
      transactionDate: t.transaction_date ?? null,
      paidAt: t.paid_at ?? null,
      referenceId: t.reference_id ?? null,
      referenceNumber: t.reference_number ?? null,
      source: t.source ?? null,
    }));
  },
  async sales(companyId, limit = 200) {
    const { rows } = await salesService.list(companyId, {
      search: "",
      status: "",
      customerId: "",
      paymentMethod: "",
      paymentStatus: "",
      sortBy: "sale_date",
      sortDir: "desc",
      page: 1,
      pageSize: limit,
    });
    return rows.map((s) => ({
      id: s.id,
      number: s.number == null ? null : String(s.number),
      status: String(s.status ?? ""),
      total: Number(s.grand_total ?? 0),
      saleDate: s.sale_date ?? null,
      customerId: s.customer_id ?? null,
      paidAt: s.paid_at ?? null,
      settledAt: s.settlement_paid_at ?? null,
    }));
  },
  async cashSessions(companyId, limit = 30) {
    const sessions = await cashService.listSessions(companyId, limit);
    return (sessions ?? []).map((s) => ({
      id: String(s.id),
      status: String(s.status ?? ""),
      openedAt: s.opened_at ?? null,
      closedAt: s.closed_at ?? null,
      expectedCash: s.expected_cash == null ? null : Number(s.expected_cash),
      countedCash: s.counted_cash == null ? null : Number(s.counted_cash),
      difference: s.difference == null ? null : Number(s.difference),
    }));
  },
  async products(companyId, limit = 500) {
    const { rows } = await productsService.list(companyId, {
      search: "",
      categoryId: "",
      supplierId: "",
      status: "",
      stock: "all",
      sortBy: "name",
      sortDir: "asc",
      page: 1,
      pageSize: limit,
    });
    return rows.map((p) => ({
      id: p.id,
      name: String(p.name ?? ""),
      sku: p.sku ?? null,
      status: p.status ?? null,
      stock: Number(p.stock ?? 0),
      minStock: Number(p.min_stock ?? 0),
      cost: p.cost == null ? null : Number(p.cost),
      price: p.price == null ? null : Number(p.price),
      unit: p.unit ?? null,
      ncm: p.ncm ?? null,
      categoryId: p.category_id ?? null,
      marketplaceId: p.ml_item_id ?? null,
    }));
  },
  async customers(companyId, limit = 500) {
    const { rows } = await customersService.list(companyId, {
      search: "",
      status: "",
      segment: "",
      state: "",
      sortBy: "name",
      sortDir: "asc",
      page: 1,
      pageSize: limit,
    });
    return rows.map((c) => ({
      id: c.id,
      name: String(c.name ?? ""),
      document: c.document ?? null,
      phone: c.phone ?? null,
      whatsapp: c.whatsapp ?? null,
      status: c.status ?? null,
    }));
  },
  async fiscalDocuments(_companyId, limit = 100) {
    const docs = await listFiscalDocuments({ data: { limit } });
    return docs.map((d) => ({
      id: d.id,
      number: d.number,
      status: String(d.status ?? ""),
      saleId: d.saleId,
      xmlAuthorizedPath: d.xmlAuthorizedPath,
      danfePath: d.danfePath,
      rejectionReason: d.rejectionReason,
    }));
  },
  async fiscalDefaults() {
    const settings = await getFiscalSettings();
    return { defaultCst: settings?.defaultCsosn ?? null };
  },
  async stagnantProducts(companyId) {
    const metrics = await inventoryService.metrics(companyId);
    return (metrics?.stagnant ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku ?? null,
      stock: Number(p.stock ?? 0),
    }));
  },
};

/**
 * Sprint 7.3 — porta de explicações. É apenas uma COMPOSIÇÃO de leituras
 * já existentes (DRE, KPIs, métricas de vendas, relatório de clientes).
 * Nenhum indicador novo é calculado aqui.
 */
export function createExplanationPort(
  services: Pick<AccountingAiServices, "accounting" | "sales">,
): ExplanationPort {
  return {
    async periodFacts(companyId, period) {
      const [dre, kpis, metrics, customers] = await Promise.all([
        services.accounting.dre(companyId, period),
        services.accounting.kpis(companyId, period),
        services.sales.metrics(companyId, period),
        services.sales.customers(companyId, period).catch(() => null),
      ]);
      return {
        period,
        grossRevenue: dre.grossRevenue,
        deductions: dre.deductions,
        netRevenue: dre.netRevenue,
        cogs: dre.cogs,
        operatingExpenses: dre.operatingExpenses,
        financialExpenses: dre.financialExpenses,
        otherExpenses: dre.otherExpenses,
        grossProfit: dre.grossProfit,
        operatingResult: dre.operatingResult,
        netProfit: dre.netProfit,
        grossMargin: dre.grossMargin,
        netMargin: dre.netMargin,
        cogsRatio: kpis.cogsRatio,
        expenseRatio: kpis.expenseRatio,
        averageTicket: metrics.averageTicket,
        salesCount: metrics.monthCount,
        paidTotal: metrics.paidTotal,
        customersActive: customers?.metrics.active ?? 0,
        customersNew: customers?.metrics.newInRange ?? 0,
        customersRecurring: customers?.metrics.recurring ?? 0,
      };
    },
  };
}

export const explanationAdapter: ExplanationPort = createExplanationPort({
  accounting: accountingAdapter,
  sales: salesAdapter,
});

/** Bundle padrão de produção. Testes injetam fakes com o mesmo shape. */
export const accountingAiServices: AccountingAiServices = {
  accounting: accountingAdapter,
  finance: financeAdapter,

  sales: salesAdapter,
  inventory: inventoryAdapter,
  fiscal: fiscalAdapter,
  cash: cashAdapter,
  audit: auditAdapter,
  explanation: explanationAdapter,
};
