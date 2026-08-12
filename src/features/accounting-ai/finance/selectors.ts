/**
 * Bella Contadora — Finance: seletores puros.
 *
 * Só transforma dados já apurados em um view model. Nada é recalculado:
 * receita/lucro/caixa vêm do `AccountingSummary`, retirada segura e
 * pró-labore vêm do `Advisor`, alertas vêm do `Proactive` e recomendações
 * vêm dos `Insights`.
 */
import { buildAccountingInsights, sortInsights, type AccountingInsight } from "../insights";
import { buildFinancialAdvice, type FinancialAdvice } from "../advisor";
import {
  buildBellaNotifications,
  sortNotifications,
  type BellaNotification,
  type NotificationCategory,
} from "../proactive";
import { healthLabel } from "../lib/health";
import type { AccountingSummary, ProviderResult } from "../types";
import { financeLink, financeLinkForAction } from "./links";
import type {
  BellaFinanceDetail,
  BellaFinanceHealth,
  BellaFinanceInput,
  BellaFinanceMetric,
  BellaFinanceOptions,
  BellaFinanceRecommendation,
  BellaFinanceView,
} from "./types";

/** Categorias financeiras oficiais do painel. */
export const FINANCE_CATEGORIES: NotificationCategory[] = [
  "financeiro",
  "caixa",
  "fiscal",
  "receita",
  "lucro",
];

const FINANCE_CATEGORY_SET = new Set<string>(FINANCE_CATEGORIES);

export function isFinanceCategory(category: string): boolean {
  return FINANCE_CATEGORY_SET.has(category);
}

/** Apenas notificações das categorias financeiras, já ordenadas. */
export function filterFinanceNotifications(
  notifications: readonly BellaNotification[],
): BellaNotification[] {
  return sortNotifications(notifications.filter((n) => isFinanceCategory(n.category)));
}

/** Apenas insights das categorias financeiras, já ordenados. */
export function filterFinanceInsights(
  insights: readonly AccountingInsight[],
): AccountingInsight[] {
  return sortInsights(insights.filter((i) => isFinanceCategory(i.category)));
}

function pick<T>(result: ProviderResult<T> | undefined, get: (data: T) => number) {
  if (!result?.available || result?.data === undefined || result?.data === null) return { value: null, available: false };
  return { value: get(result.data), available: true };
}

/** Indicadores do painel — todos já existentes em outros motores. */
export function buildFinanceMetrics(
  summary: AccountingSummary | null | undefined,
  advice: FinancialAdvice | null,
): BellaFinanceMetric[] {
  const revenue = pick(summary?.revenue, (d) => d.netRevenue);
  const profit = pick(summary?.profit, (d) => d.netProfit);
  const cash = pick(summary?.cash, (d) => d.currentBalance);
  const payable = pick(summary?.cash, (d) => d.payable);
  const receivable = pick(summary?.cash, (d) => d.receivable);

  return [
    {
      id: "receita",
      label: "Receita",
      ...revenue,
      hint: "Receita líquida do período",
      link: financeLink("ver_relatorio"),
    },
    {
      id: "lucro",
      label: "Lucro",
      ...profit,
      hint: "Lucro líquido do período",
      link: financeLink("ver_relatorio"),
    },
    {
      id: "caixa",
      label: "Caixa",
      ...cash,
      hint: "Saldo atual das contas",
      link: financeLink("ver_caixa"),
    },
    { id: "a_pagar", label: "A pagar", ...payable, link: financeLink("ver_contas") },
    { id: "a_receber", label: "A receber", ...receivable, link: financeLink("abrir_contas") },
    {
      id: "retirada_segura",
      label: "Retirada segura",
      value: advice?.available ? advice.withdrawal.safeAmount : null,
      available: Boolean(advice?.available),
      hint: "Caixa − compromissos − reserva",
      link: financeLink("ver_caixa"),
    },
  ];
}

/** Detalhes financeiros (contas, previstos e pró-labore). */
export function buildFinanceDetails(
  summary: AccountingSummary | null | undefined,
  advice: FinancialAdvice | null,
): BellaFinanceDetail[] {
  const cash = summary?.cash.available ? summary.cash.data : null;
  const flow = summary?.cashFlow.available ? summary.cashFlow.data : null;
  const payroll = summary?.payroll.available ? summary.payroll.data : null;

  return [
    {
      id: "contas_vencendo",
      label: "Contas vencendo",
      value: cash ? cash.payable : null,
      available: Boolean(cash),
      hint: "Compromissos em aberto a pagar",
      link: financeLink("ver_contas"),
    },
    {
      id: "contas_atraso",
      label: "Contas em atraso",
      value: cash ? cash.receivableOverdue : null,
      available: Boolean(cash),
      hint: "Recebíveis vencidos",
      link: financeLink("abrir_contas"),
    },
    {
      id: "recebimentos_previstos",
      label: "Recebimentos previstos",
      value: flow ? flow.incoming : null,
      available: Boolean(flow),
      hint: flow ? `Horizonte de ${flow.horizonDays} dias` : undefined,
      link: financeLink("ver_fluxo"),
    },
    {
      id: "pagamentos_previstos",
      label: "Pagamento previsto",
      value: flow ? flow.outgoing : null,
      available: Boolean(flow),
      hint: flow ? `Horizonte de ${flow.horizonDays} dias` : undefined,
      link: financeLink("ver_fluxo"),
    },
    {
      id: "prolabore_sugerido",
      label: "Pró-labore sugerido",
      value: advice?.available
        ? advice.payroll.suggestedAmount
        : payroll
          ? payroll.suggestedAmount
          : null,
      available: Boolean(advice?.available || payroll),
      hint: advice?.available ? advice.payroll.rationale : payroll?.rationale,
      link: financeLink("ver_relatorio"),
    },
  ];
}

export function buildFinanceHealth(
  summary: AccountingSummary | null | undefined,
): BellaFinanceHealth | null {
  const health = summary?.health.available ? summary.health.data : null;
  if (!health) return null;
  return {
    level: health.level,
    score: health.score,
    label: healthLabel(health),
    reasons: health.financial?.reasons ?? [],
  };
}

/** Recomendações financeiras com destino de navegação. */
export function buildFinanceRecommendations(
  insights: readonly AccountingInsight[],
  limit = 5,
): BellaFinanceRecommendation[] {
  return filterFinanceInsights(insights)
    .slice(0, Math.max(0, limit))
    .map((insight) => ({
      id: insight.id,
      title: insight.title,
      description: insight.description,
      recommendation: insight.recommendation,
      severity: insight.severity,
      category: insight.category,
      priority: insight.priority,
      link: financeLinkForAction(insight.action.id),
    }));
}

/** View model completo do painel "Bella Financeira". */
export function buildBellaFinanceView(
  input: BellaFinanceInput,
  options: BellaFinanceOptions = {},
): BellaFinanceView {
  const summary = input.summary ?? null;
  const generatedAt = options.now ?? summary?.generatedAt ?? new Date().toISOString();

  if (!summary) {
    return {
      available: false,
      generatedAt,
      metrics: buildFinanceMetrics(null, null),
      details: buildFinanceDetails(null, null),
      health: null,
      advice: null,
      alerts: [],
      recommendations: [],
      missing: ["resumo financeiro"],
    };
  }

  const insights = input.insights ?? buildAccountingInsights(summary);
  const advice = input.advice ?? buildFinancialAdvice({ summary });
  const notifications =
    input.notifications ?? buildBellaNotifications({ summary, insights, advice });

  return {
    available: true,
    generatedAt,
    metrics: buildFinanceMetrics(summary, advice),
    details: buildFinanceDetails(summary, advice),
    health: buildFinanceHealth(summary),
    advice,
    alerts: filterFinanceNotifications(notifications).slice(
      0,
      Math.max(0, options.alertLimit ?? 5),
    ),
    recommendations: buildFinanceRecommendations(
      insights,
      options.recommendationLimit ?? 5,
    ),
    missing: advice?.missing ?? [],
  };
}
