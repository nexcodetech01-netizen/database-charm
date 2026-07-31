import { BellaProviderRegistry } from "../providers/modules/registry";
import type {
  BellaActionContext,
  BellaActionHandler,
  BellaActionResponse,
} from "./types";
import type { BellaMetric } from "../providers/modules/base";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function financeMetrics(ctx: BellaActionContext): Promise<BellaMetric[]> {
  const provider = BellaProviderRegistry.get("finance");
  if (!provider) return [];
  return provider.getMetrics(ctx);
}

async function financeSummary(ctx: BellaActionContext) {
  const provider = BellaProviderRegistry.get("finance");
  return provider ? provider.getSummary(ctx) : null;
}

async function financeSuggestions(ctx: BellaActionContext) {
  const provider = BellaProviderRegistry.get("finance");
  return provider ? provider.getSuggestions(ctx) : [];
}

function pickMetric(metrics: BellaMetric[], key: string): BellaMetric | undefined {
  return metrics.find((m) => m.key === key);
}

function suggestionsFrom(list: Awaited<ReturnType<typeof financeSuggestions>>) {
  return list.map((s) => ({ id: s.id, title: s.title, actionLabel: s.actionLabel }));
}

export const getCashBalanceHandler: BellaActionHandler = {
  action: "GET_CASH_BALANCE",
  async execute(ctx): Promise<BellaActionResponse> {
    const metrics = await financeMetrics(ctx);
    const m = pickMetric(metrics, "cash_balance");
    return {
      action: "GET_CASH_BALANCE",
      title: "Saldo em caixa",
      description: m ? `Saldo atual: ${m.value}.` : "Sem dados de saldo disponíveis.",
      metrics: m ? [m] : [],
      priority: "low",
      suggestions: suggestionsFrom(await financeSuggestions(ctx)),
    };
  },
};

export const getMonthRevenueHandler: BellaActionHandler = {
  action: "GET_MONTH_REVENUE",
  async execute(ctx) {
    const metrics = await financeMetrics(ctx);
    const m = pickMetric(metrics, "month_income");
    return {
      action: "GET_MONTH_REVENUE",
      title: "Receitas do mês",
      description: m ? `Receitas do mês: ${m.value}.` : "Sem receitas registradas neste mês.",
      metrics: m ? [m] : [],
      priority: "low",
      suggestions: suggestionsFrom(await financeSuggestions(ctx)),
    };
  },
};

export const getMonthExpensesHandler: BellaActionHandler = {
  action: "GET_MONTH_EXPENSES",
  async execute(ctx) {
    const metrics = await financeMetrics(ctx);
    const m = pickMetric(metrics, "month_expense");
    return {
      action: "GET_MONTH_EXPENSES",
      title: "Despesas do mês",
      description: m ? `Despesas do mês: ${m.value}.` : "Sem despesas registradas neste mês.",
      metrics: m ? [m] : [],
      priority: "medium",
      suggestions: suggestionsFrom(await financeSuggestions(ctx)),
    };
  },
};

export const getOverdueBillsHandler: BellaActionHandler = {
  action: "GET_OVERDUE_BILLS",
  async execute(ctx) {
    const metrics = await financeMetrics(ctx);
    const m = pickMetric(metrics, "overdue");
    const count = m ? Number(m.value) || 0 : 0;
    return {
      action: "GET_OVERDUE_BILLS",
      title: "Contas vencidas",
      description:
        count > 0
          ? `Existem ${count} conta(s) vencida(s). Regularize para evitar juros.`
          : "Nenhuma conta vencida no momento.",
      metrics: m ? [m] : [],
      priority: count > 0 ? "high" : "low",
      suggestions: suggestionsFrom(await financeSuggestions(ctx)),
    };
  },
};

export const getCashflowHandler: BellaActionHandler = {
  action: "GET_CASHFLOW",
  async execute(ctx) {
    const metrics = await financeMetrics(ctx);
    const m = pickMetric(metrics, "forecast_30d");
    const receivable = pickMetric(metrics, "receivable");
    const payable = pickMetric(metrics, "payable");
    const priority: BellaActionResponse["priority"] = m?.trend === "down" ? "high" : "low";
    return {
      action: "GET_CASHFLOW",
      title: "Fluxo de caixa (30 dias)",
      description: m
        ? `Projeção líquida para os próximos 30 dias: ${m.value}.`
        : "Sem projeção disponível.",
      metrics: [m, receivable, payable].filter((x): x is BellaMetric => !!x),
      priority,
      suggestions: suggestionsFrom(await financeSuggestions(ctx)),
    };
  },
};

export const getFinancialSummaryHandler: BellaActionHandler = {
  action: "GET_FINANCIAL_SUMMARY",
  async execute(ctx) {
    const [metrics, summary, suggestions] = await Promise.all([
      financeMetrics(ctx),
      financeSummary(ctx),
      financeSuggestions(ctx),
    ]);
    const income = pickMetric(metrics, "month_income");
    const expense = pickMetric(metrics, "month_expense");
    const profit =
      income && expense
        ? Number(income.value.replace(/[^\d.-]/g, "")) -
          Number(expense.value.replace(/[^\d.-]/g, ""))
        : null;

    return {
      action: "GET_FINANCIAL_SUMMARY",
      title: summary?.headline ?? "Resumo financeiro",
      description:
        summary?.highlights.join(" · ") ??
        (profit != null ? `Resultado do mês: ${BRL.format(profit)}.` : "Sem dados suficientes."),
      metrics,
      priority: profit != null && profit < 0 ? "high" : "low",
      suggestions: suggestionsFrom(suggestions),
    };
  },
};

export const financeHandlers: BellaActionHandler[] = [
  getCashBalanceHandler,
  getMonthRevenueHandler,
  getMonthExpensesHandler,
  getOverdueBillsHandler,
  getCashflowHandler,
  getFinancialSummaryHandler,
];
