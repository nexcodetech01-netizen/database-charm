/**
 * Bella Contadora — providers somente leitura.
 *
 * Regras invioláveis:
 *  - nenhum provider acessa Supabase;
 *  - nenhum provider recalcula imposto, custo, estoque ou resultado;
 *  - toda leitura passa pelas portas (`AccountingAiServices`).
 */
import type { DreReport, FinancialKpis } from "@/features/accounting";
import type { AuditSnapshot } from "../audit/types";
import type { ExplanationSnapshot } from "../explanation/types";
import type {
  AccountingPeriod,
  AccountingSummary,
  AccountingTrends,
  BusinessHealth,
  CashProjection,
  CashSnapshot,
  CustomerSnapshot,
  DailyRevenue,
  ExpenseSnapshot,
  InventorySnapshot,
  MarginSnapshot,
  PayrollSuggestion,
  ProductRanking,
  ProfitAnalysis,
  ProlaboreSafeSnapshot,
  ProviderResult,
  RestockSuggestionsSnapshot,
  RevenueSnapshot,
  TaxSummary,
  TicketSnapshot,
} from "../types";
import type { AccountingAiServices } from "../services/ports";
import type { BellaTaxSimulationInput, BellaTaxSnapshot } from "../tax/types";
import { accountingAiServices } from "../services/adapters";
import {
  currentPeriod,
  dayPeriod,
  previousDayISO,
  previousMonthPeriod,
  readSafely,
  todayISO,
  unavailable,
} from "../lib/helpers";
import { computeTrend } from "../lib/trend";
import { computeFinancialHealth } from "../lib/health";
import { suggestPayroll } from "../lib/payroll";

export interface ProviderDeps {
  services?: AccountingAiServices;
  /**
   * Resumo consolidado já agregado (Sprint 6.1.6 — P1).
   * Quando presente, skills e consumidores reutilizam este objeto em vez de
   * reconstruir `buildAccountingSummary`. Nenhum provider recalcula nada.
   */
  summary?: AccountingSummary | null;
  period?: AccountingPeriod;
  /** Data operacional (ISO). Quando ausente, usa a data local. */
  today?: string;
  /**
   * Sprint 7.1 — retrato tributário já lido nesta pergunta. Evita repetir
   * as chamadas ao motor oficial quando várias skills o consomem.
   */
  taxSnapshot?: ProviderResult<BellaTaxSnapshot> | null;
  /** Sprint 7.1 — parâmetros de simulação tributária vindos do chat/UI. */
  simulation?: BellaTaxSimulationInput | null;
  /** Sprint 7.2 — retrato de auditoria já lido (evita releitura por pergunta). */
  auditSnapshot?: ProviderResult<AuditSnapshot> | null;
  /** Sprint 7.3 — retrato de explicações já lido (evita releitura por pergunta). */
  explanation?: ProviderResult<ExplanationSnapshot> | null;
  /**
   * Cache válido somente durante uma chamada de `buildAccountingSummary()`.
   * Compartilha DRE e KPIs idênticos entre providers concorrentes sem manter
   * dados entre aberturas da Bella. Providers isolados continuam sem cache.
   */
  cache?: Map<string, Promise<unknown>>;
}

function resolve(deps?: ProviderDeps) {
  return {
    services: deps?.services ?? accountingAiServices,
    period: deps?.period ?? currentPeriod(),
  };
}

function periodCacheKey(prefix: string, companyId: string, period: AccountingPeriod): string {
  return `${prefix}:${companyId}:${period.start}:${period.end}`;
}

function cachedDre(
  companyId: string,
  period: AccountingPeriod,
  services: AccountingAiServices,
  cache?: Map<string, Promise<unknown>>,
): Promise<DreReport> {
  if (!cache) return services.accounting.dre(companyId, period);
  const key = periodCacheKey("dre", companyId, period);
  if (!cache.has(key)) cache.set(key, services.accounting.dre(companyId, period));
  return cache.get(key) as Promise<DreReport>;
}

function cachedKpis(
  companyId: string,
  period: AccountingPeriod,
  services: AccountingAiServices,
  cache?: Map<string, Promise<unknown>>,
): Promise<FinancialKpis> {
  if (!cache) return services.accounting.kpis(companyId, period);
  const key = periodCacheKey("kpis", companyId, period);
  if (!cache.has(key)) cache.set(key, services.accounting.kpis(companyId, period));
  return cache.get(key) as Promise<FinancialKpis>;
}

export async function revenueProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<RevenueSnapshot>> {
  const { services, period } = resolve(deps);
  return readSafely("accounting", async () => {
    const dre = await cachedDre(companyId, period, services, deps?.cache);
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
    const dre = await cachedDre(companyId, period, services, deps?.cache);
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
      cachedDre(companyId, period, services, deps?.cache),
      cachedKpis(companyId, period, services, deps?.cache),
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
    const kpis = await cachedKpis(companyId, period, services, deps?.cache);
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
    const dre = await cachedDre(companyId, period, services, deps?.cache);
    return suggestPayroll(period, dre.netProfit);
  }, "Sugestão indicativa — não grava nada no Financeiro.");
}

export async function prolaboreSafeProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<ProlaboreSafeSnapshot>> {
  const { services } = resolve(deps);
  return readSafely("finance", async () => {
    const safe = await services.finance.proLaboreSafeAmount(companyId);
    return {
      cashBalance: safe.cashBalance,
      payables30d: safe.payables30d,
      restockReserve30d: safe.restockReserve30d,
      safeAmount: safe.safeAmount,
      asOf: safe.asOf,
    };
  }, "Teto seguro único — caixa menos contas a pagar (30 dias) menos custo de reposição de estoque (30 dias).");
}

/**
 * Sugestão de reposição (2026-09-23): quanto comprar de cada produto,
 * olhando a velocidade de venda dos últimos 60 dias — não só "abaixo do
 * mínimo". Sempre calculada no banco (`compute_restock_suggestions`);
 * apenas sugere, nunca cria pedido de compra.
 */
export async function restockSuggestionsProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<RestockSuggestionsSnapshot>> {
  const { services } = resolve(deps);
  return readSafely(
    "inventory",
    async () => services.inventory.restockSuggestions(companyId),
    "Sugestão com base na venda dos últimos 60 dias — não considera sazonalidade nem prazo de entrega do fornecedor.",
  );
}

export async function healthProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<BusinessHealth>> {
  const { services, period } = resolve(deps);
  const result = await readSafely("accounting", async () => {
    const [kpis, dre] = await Promise.all([
      cachedKpis(companyId, period, services, deps?.cache),
      cachedDre(companyId, period, services, deps?.cache),
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
      cachedDre(companyId, period, services, deps?.cache),
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

