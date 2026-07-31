/**
 * Bella Contadora — providers somente leitura.
 *
 * Regras invioláveis:
 *  - nenhum provider acessa Supabase;
 *  - nenhum provider recalcula imposto, custo, estoque ou resultado;
 *  - toda leitura passa pelas portas (`AccountingAiServices`).
 */
import type {
  AccountingPeriod,
  BusinessHealth,
  CashProjection,
  CashSnapshot,
  CustomerSnapshot,
  ExpenseSnapshot,
  InventorySnapshot,
  MarginSnapshot,
  PayrollSuggestion,
  ProductRanking,
  ProfitAnalysis,
  ProviderResult,
  RevenueSnapshot,
  TaxSummary,
  TicketSnapshot,
} from "../types";
import type { AccountingAiServices } from "../services/ports";
import { accountingAiServices } from "../services/adapters";
import { currentPeriod, readSafely, unavailable } from "../lib/helpers";
import { computeFinancialHealth } from "../lib/health";
import { suggestPayroll } from "../lib/payroll";

export interface ProviderDeps {
  services?: AccountingAiServices;
  period?: AccountingPeriod;
}

function resolve(deps?: ProviderDeps) {
  return {
    services: deps?.services ?? accountingAiServices,
    period: deps?.period ?? currentPeriod(),
  };
}

export async function revenueProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<RevenueSnapshot>> {
  const { services, period } = resolve(deps);
  return readSafely("accounting", async () => {
    const dre = await services.accounting.dre(companyId, period);
    return {
      period,
      grossRevenue: dre.grossRevenue,
      deductions: dre.deductions,
      netRevenue: dre.netRevenue,
    };
  });
}

export async function profitProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<ProfitAnalysis>> {
  const { services, period } = resolve(deps);
  return readSafely("accounting", async () => {
    const dre = await services.accounting.dre(companyId, period);
    return {
      period,
      grossProfit: dre.grossProfit,
      operatingResult: dre.operatingResult,
      netProfit: dre.netProfit,
      ebitda: dre.ebitda,
      grossMargin: dre.grossMargin,
      operatingMargin: dre.operatingMargin,
      netMargin: dre.netMargin,
      ebitdaMargin: dre.ebitdaMargin,
    };
  });
}

export async function expensesProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<ExpenseSnapshot>> {
  const { services, period } = resolve(deps);
  return readSafely("accounting", async () => {
    const [dre, kpis] = await Promise.all([
      services.accounting.dre(companyId, period),
      services.accounting.kpis(companyId, period),
    ]);
    return {
      period,
      cogs: dre.cogs,
      operatingExpenses: dre.operatingExpenses,
      financialExpenses: dre.financialExpenses,
      otherExpenses: dre.otherExpenses,
      totalExpenses:
        dre.cogs + dre.operatingExpenses + dre.financialExpenses + dre.otherExpenses,
      cogsRatio: kpis.cogsRatio,
      expenseRatio: kpis.expenseRatio,
    };
  });
}

export async function cashProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<CashSnapshot>> {
  const { services } = resolve(deps);
  return readSafely("finance", async () => {
    const [snapshot, sessions] = await Promise.all([
      services.finance.snapshot(companyId),
      services.cash.listSessions(companyId, 10).catch(() => []),
    ]);
    return {
      currentBalance: snapshot.overview.currentBalance,
      receivable: snapshot.overview.receivable,
      receivableOverdue: snapshot.overview.receivableOverdue,
      payable: snapshot.overview.payable,
      projected: snapshot.overview.projected,
      openSessions: sessions.filter((s) => s.status === "open").length,
    };
  });
}

export async function cashFlowProvider(
  companyId: string,
  deps?: ProviderDeps,
  months = 6,
): Promise<ProviderResult<CashProjection>> {
  const { services } = resolve(deps);
  return readSafely("finance", async () => {
    const [snapshot, evolution] = await Promise.all([
      services.finance.snapshot(companyId),
      services.accounting.monthlyEvolution(companyId, months).catch(() => []),
    ]);
    return {
      horizonDays: 30,
      incoming: snapshot.forecast30d.incoming,
      outgoing: snapshot.forecast30d.outgoing,
      net: snapshot.forecast30d.net,
      projectedBalance: snapshot.overview.currentBalance + snapshot.forecast30d.net,
      monthly: evolution.map((m) => ({
        label: m.label,
        netRevenue: m.dre.netRevenue,
        netProfit: m.dre.netProfit,
      })),
    };
  });
}

export async function taxesProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<TaxSummary>> {
  const { services, period } = resolve(deps);
  return readSafely("fiscal", async () => {
    const competence = period.start.slice(0, 7);
    const apportionments = await services.fiscal.apportionments(companyId, 24);
    const found = apportionments.find((a) => a.competence.slice(0, 7) === competence);
    if (found) {
      return {
        competence,
        revenue: found.revenue,
        taxAmount: found.taxAmount,
        effectiveRate: found.effectiveRate,
        status: found.status,
        dueDate: found.dueDate,
      };
    }
    const revenue = await services.fiscal.monthlyRevenue(companyId, competence);
    return {
      competence,
      revenue,
      taxAmount: 0,
      effectiveRate: 0,
      status: null,
      dueDate: null,
    };
  });
}

export async function inventoryProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<InventorySnapshot>> {
  const { services } = resolve(deps);
  return readSafely("inventory", async () => {
    const m = await services.inventory.metrics(companyId);
    return {
      productCount: m.productCount,
      totalItems: m.totalItems,
      inventoryValue: m.inventoryValue,
      belowMinCount: m.belowMin.length,
      stagnantCount: m.stagnant.length,
    };
  });
}

export async function ticketProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<TicketSnapshot>> {
  const { services, period } = resolve(deps);
  return readSafely("sales", async () => {
    const m = await services.sales.metrics(companyId, period);
    return {
      period,
      averageTicket: m.averageTicket,
      salesCount: m.monthCount,
      monthTotal: m.monthTotal,
    };
  });
}

export async function marginProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<MarginSnapshot>> {
  const { services, period } = resolve(deps);
  return readSafely("accounting", async () => {
    const kpis = await services.accounting.kpis(companyId, period);
    return {
      period,
      grossMargin: kpis.grossMargin,
      operatingMargin: kpis.operatingMargin,
      netMargin: kpis.netMargin,
      ebitdaMargin: kpis.ebitdaMargin,
      breakEven: kpis.breakEven,
    };
  });
}

export async function productsProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<ProductRanking>> {
  const { services, period } = resolve(deps);
  return readSafely("reports", async () => {
    const [report, inventory] = await Promise.all([
      services.sales.products(companyId, period),
      services.inventory.metrics(companyId),
    ]);
    return {
      bestSellers: report.bestSellers.slice(0, 5),
      worstSellers: report.worstSellers.slice(0, 5),
      stagnant: (report.noMovement.length ? report.noMovement : inventory.stagnant).slice(0, 5),
      lowStock: inventory.belowMin.slice(0, 5),
    };
  });
}

export async function customersProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<CustomerSnapshot>> {
  const { services, period } = resolve(deps);
  return readSafely("reports", async () => {
    const report = await services.sales.customers(companyId, period);
    return {
      total: report.metrics.total,
      active: report.metrics.active,
      newInRange: report.metrics.newInRange,
      recurring: report.metrics.recurring,
      topCustomers: report.topCustomers.slice(0, 5),
    };
  });
}

export async function payrollProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<PayrollSuggestion>> {
  const { services, period } = resolve(deps);
  return readSafely("accounting", async () => {
    const dre = await services.accounting.dre(companyId, period);
    return suggestPayroll(period, dre.netProfit);
  }, "Sugestão indicativa — não grava nada no Financeiro.");
}

export async function healthProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<BusinessHealth>> {
  const { services, period } = resolve(deps);
  const result = await readSafely("accounting", async () => {
    const [kpis, dre] = await Promise.all([
      services.accounting.kpis(companyId, period),
      services.accounting.dre(companyId, period),
    ]);
    const financial = computeFinancialHealth({
      liquidity: kpis.currentLiquidity,
      workingCapital: kpis.workingCapital,
      debtRatio: kpis.debtRatio,
      netMargin: kpis.netMargin,
    });
    const highlights: string[] = [];
    const warnings: string[] = [...financial.reasons];
    if (dre.netProfit > 0) highlights.push("Resultado positivo no período.");
    if (kpis.ebitdaMargin > 15) highlights.push("Margem EBITDA acima de 15%.");
    if (dre.netRevenue > 0 && kpis.breakEven > dre.netRevenue) {
      warnings.push("Receita abaixo do ponto de equilíbrio.");
    }
    const health: BusinessHealth = {
      level: financial.level,
      score: financial.score,
      financial,
      highlights,
      warnings,
    };
    return health;
  });
  return result.data ? result : unavailable<BusinessHealth>("accounting");
}

/**
 * Receita de hoje — lida das métricas de vendas (data operacional
 * resolvida no servidor pelo próprio serviço de vendas).
 */
export async function todayProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<DailyRevenue>> {
  const { services } = resolve(deps);
  const date = deps?.today ?? todayISO();
  return readSafely("sales", async () => {
    const m = await services.sales.metrics(companyId, dayPeriod(date));
    return { date, total: m.dayTotal, count: m.dayCount };
  });
}

/**
 * Comparativos hoje x ontem e mês atual x mês anterior.
 * Quando o motor de origem não devolve histórico, a comparação fica
 * marcada como `hasHistory: false` ("sem histórico suficiente").
 */
export async function trendsProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<AccountingTrends>> {
  const { services, period } = resolve(deps);
  const date = deps?.today ?? todayISO();
  const previous = previousMonthPeriod(period);

  return readSafely("accounting", async () => {
    const [todayMetrics, yesterdayTotal, currentDre, previousDre] = await Promise.all([
      services.sales.metrics(companyId, dayPeriod(date)),
      services.sales
        .metrics(companyId, dayPeriod(previousDayISO(date)))
        .then((m) => m.paidTotal as number | null)
        .catch(() => null),
      services.accounting.dre(companyId, period),
      services.accounting.dre(companyId, previous).catch(() => null),
    ]);

    return {
      todayVsYesterday: computeTrend(todayMetrics.dayTotal, yesterdayTotal),
      monthVsPreviousRevenue: computeTrend(
        currentDre.netRevenue,
        previousDre ? previousDre.netRevenue : null,
      ),
      monthVsPreviousProfit: computeTrend(
        currentDre.netProfit,
        previousDre ? previousDre.netProfit : null,
      ),
    };
  });
}
