import {
  financeQueryService,
  type FinanceSnapshot,
} from "@/features/finance";
import type {
  BellaAlert,
  BellaInsight,
  BellaMetric,
  BellaModuleProvider,
  BellaProviderContext,
  BellaSuggestion,
  BellaSummary,
} from "./base";
import { financeProvider as financeMockProvider } from "./finance.provider";

/**
 * FinanceProviderReal
 *
 * Primeira integração real da Bella IA com o módulo Financeiro.
 *
 * - Consome exclusivamente `financeQueryService` (que reutiliza
 *   `financeService`). Não toca no Supabase diretamente.
 * - Cada método garante fallback para o provider mock quando não há
 *   dados no tenant ou quando a consulta falhar — a Bella nunca deve
 *   saber de onde vieram os dados.
 * - Não altera layout, componentes visuais nem rotas.
 */

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function loadSnapshot(companyId: string): Promise<FinanceSnapshot | null> {
  if (!companyId) return null;
  try {
    const snap = await financeQueryService.snapshot(companyId);
    return snap.hasData ? snap : null;
  } catch {
    return null;
  }
}

function trendOf(current: number, ref = 0): BellaMetric["trend"] {
  if (current > ref) return "up";
  if (current < ref) return "down";
  return "flat";
}

// ---------------------------------------------------------------------------
// generateFinancialInsights — transforma snapshot em insights consumíveis
// pela UI atual da Bella (BellaInsight[]).
// ---------------------------------------------------------------------------
export function generateFinancialInsights(snap: FinanceSnapshot): BellaInsight[] {
  const now = new Date().toISOString();
  const insights: BellaInsight[] = [];
  const { overview, overdueCount, overdueAmount, forecast30d } = snap;

  // Reserva mínima heurística: 30% das despesas do mês vigente.
  const reserveTarget = overview.monthExpense * 0.3;
  if (reserveTarget > 0 && overview.currentBalance < reserveTarget) {
    insights.push({
      id: "fin-cash-below-reserve",
      module: "finance",
      title: "Caixa abaixo da reserva recomendada",
      description: `Saldo atual ${BRL.format(overview.currentBalance)} está abaixo da reserva sugerida (${BRL.format(reserveTarget)}).`,
      priority: "high",
      createdAt: now,
    });
  }

  if (overdueCount > 0) {
    insights.push({
      id: "fin-overdue",
      module: "finance",
      title: `${overdueCount} conta(s) vencida(s)`,
      description: `Total em atraso: ${BRL.format(overdueAmount)}. Regularize para evitar juros e impacto no fluxo.`,
      priority: overdueAmount > overview.currentBalance ? "urgent" : "high",
      createdAt: now,
    });
  }

  if (overview.monthExpense > 0 && overview.monthExpense > overview.monthIncome) {
    insights.push({
      id: "fin-expenses-up",
      module: "finance",
      title: "Despesas superam receitas no mês",
      description: `Receitas ${BRL.format(overview.monthIncome)} vs despesas ${BRL.format(overview.monthExpense)}.`,
      priority: "high",
      createdAt: now,
    });
  } else if (overview.monthIncome > 0 && overview.monthIncome > overview.monthExpense) {
    insights.push({
      id: "fin-revenue-up",
      module: "finance",
      title: "Receitas acima das despesas no mês",
      description: `Superávit de ${BRL.format(overview.monthIncome - overview.monthExpense)} no mês atual.`,
      priority: "low",
      createdAt: now,
    });
  }

  if (forecast30d.net > 0) {
    insights.push({
      id: "fin-forecast-positive",
      module: "finance",
      title: "Fluxo previsto positivo (30 dias)",
      description: `Projeção líquida de ${BRL.format(forecast30d.net)} considerando lançamentos em aberto.`,
      priority: "low",
      createdAt: now,
    });
  } else if (forecast30d.net < 0) {
    insights.push({
      id: "fin-forecast-negative",
      module: "finance",
      title: "Fluxo previsto negativo (30 dias)",
      description: `Projeção líquida de ${BRL.format(forecast30d.net)}. Antecipe recebíveis ou renegocie despesas.`,
      priority: "urgent",
      createdAt: now,
    });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Provider real
// ---------------------------------------------------------------------------

export const financeRealProvider: BellaModuleProvider = {
  module: "finance",
  displayName: "Financeiro",

  async getInsights(ctx: BellaProviderContext): Promise<BellaInsight[]> {
    const snap = await loadSnapshot(ctx.companyId);
    if (!snap) return financeMockProvider.getInsights(ctx);
    const insights = generateFinancialInsights(snap);
    return insights.length ? insights : financeMockProvider.getInsights(ctx);
  },

  async getSummary(ctx: BellaProviderContext): Promise<BellaSummary> {
    const snap = await loadSnapshot(ctx.companyId);
    if (!snap) return financeMockProvider.getSummary(ctx);
    const { overview, overdueCount, forecast30d } = snap;
    return {
      module: "finance",
      headline:
        forecast30d.net >= 0
          ? "Saúde financeira estável"
          : "Atenção ao fluxo de caixa dos próximos 30 dias",
      highlights: [
        `Saldo em caixa: ${BRL.format(overview.currentBalance)}`,
        `A receber: ${BRL.format(overview.receivable)}`,
        `A pagar: ${BRL.format(overview.payable)}`,
        `Vencidas: ${overdueCount}`,
        `Projeção 30d: ${BRL.format(forecast30d.net)}`,
      ],
      updatedAt: new Date().toISOString(),
    };
  },

  async getAlerts(ctx: BellaProviderContext): Promise<BellaAlert[]> {
    const snap = await loadSnapshot(ctx.companyId);
    if (!snap) return financeMockProvider.getAlerts(ctx);
    const now = new Date().toISOString();
    const alerts: BellaAlert[] = [];
    if (snap.overdueCount > 0) {
      alerts.push({
        id: "fin-alert-overdue",
        module: "finance",
        title: `${snap.overdueCount} título(s) vencido(s)`,
        description: `Total em atraso: ${BRL.format(snap.overdueAmount)}.`,
        severity: "critical",
        createdAt: now,
      });
    }
    if (snap.forecast30d.net < 0) {
      alerts.push({
        id: "fin-alert-forecast",
        module: "finance",
        title: "Fluxo previsto negativo (30 dias)",
        description: `Projeção líquida ${BRL.format(snap.forecast30d.net)}.`,
        severity: "warning",
        createdAt: now,
      });
    }
    return alerts;
  },

  async getMetrics(ctx: BellaProviderContext): Promise<BellaMetric[]> {
    const snap = await loadSnapshot(ctx.companyId);
    if (!snap) return financeMockProvider.getMetrics(ctx);
    const { overview, overdueCount, forecast30d } = snap;
    return [
      { key: "cash_balance", label: "Saldo em caixa", value: BRL.format(overview.currentBalance), trend: trendOf(overview.currentBalance) },
      { key: "month_income", label: "Receitas do mês", value: BRL.format(overview.monthIncome), trend: trendOf(overview.monthIncome) },
      { key: "month_expense", label: "Despesas do mês", value: BRL.format(overview.monthExpense), trend: trendOf(overview.monthExpense) },
      { key: "receivable", label: "A receber", value: BRL.format(overview.receivable) },
      { key: "payable", label: "A pagar", value: BRL.format(overview.payable) },
      { key: "overdue", label: "Vencidas", value: String(overdueCount), trend: overdueCount > 0 ? "down" : "flat" },
      { key: "forecast_30d", label: "Fluxo 30d", value: BRL.format(forecast30d.net), trend: trendOf(forecast30d.net) },
    ];
  },

  async getSuggestions(ctx: BellaProviderContext): Promise<BellaSuggestion[]> {
    const snap = await loadSnapshot(ctx.companyId);
    if (!snap) return financeMockProvider.getSuggestions(ctx);
    const suggestions: BellaSuggestion[] = [];
    if (snap.overdueCount > 0) {
      suggestions.push({
        id: "fin-sug-collect-overdue",
        module: "finance",
        title: "Cobrar títulos vencidos",
        description: `Envie lembretes para ${snap.overdueCount} conta(s) em atraso (${BRL.format(snap.overdueAmount)}).`,
        actionLabel: "Ver vencidas",
        priority: "high",
      });
    }
    if (snap.forecast30d.net < 0) {
      suggestions.push({
        id: "fin-sug-anticipate",
        module: "finance",
        title: "Antecipar recebíveis",
        description: "Fluxo previsto negativo — avalie antecipar recebimentos ou postergar despesas.",
        actionLabel: "Simular antecipação",
        priority: "high",
      });
    }
    return suggestions.length ? suggestions : financeMockProvider.getSuggestions(ctx);
  },
};
