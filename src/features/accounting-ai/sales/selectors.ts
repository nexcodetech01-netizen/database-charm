/**
 * Bella Contadora — Vendas: seletores puros.
 *
 * Somente transformam dados JÁ apurados em um view model. NADA é
 * recalculado: faturamento, ticket, contagens e status vêm de
 * `salesService.metrics`; margem, lucro, ranking de produtos, clientes,
 * tendências e saúde vêm do `AccountingSummary`; alertas proativos vêm do
 * `Proactive`; recomendações vêm dos `Insights`.
 */
import { buildAccountingInsights, sortInsights, type AccountingInsight } from "../insights";
import {
  buildBellaNotifications,
  sortNotifications,
  type BellaNotification,
  type NotificationCategory,
} from "../proactive";
import { healthLabel } from "../lib/health";
import type { AccountingSummary, TrendComparison } from "../types";
import {
  salesCustomerLink,
  salesLink,
  salesLinkForAction,
  salesProductLink,
} from "./links";
import type {
  BellaSalesAlert,
  BellaSalesDetail,
  BellaSalesHealth,
  BellaSalesInput,
  BellaSalesMetric,
  BellaSalesMetricsLike,
  BellaSalesOptions,
  BellaSalesRecommendation,
  BellaSalesView,
} from "./types";

/** Categorias consideradas de vendas nos filtros do painel. */
export const SALES_CATEGORIES: NotificationCategory[] = [
  "receita",
  "lucro",
  "clientes",
  "produtos",
];

const SALES_CATEGORY_SET = new Set<string>(SALES_CATEGORIES);

export function isSalesCategory(category: string): boolean {
  return SALES_CATEGORY_SET.has(category);
}

export function filterSalesNotifications(
  notifications: readonly BellaNotification[],
): BellaNotification[] {
  return sortNotifications(notifications.filter((n) => isSalesCategory(n.category)));
}

export function filterSalesInsights(
  insights: readonly AccountingInsight[],
): AccountingInsight[] {
  return sortInsights(insights.filter((i) => isSalesCategory(i.category)));
}

const num = (value: number | null | undefined): number => Number(value ?? 0);

export interface SalesCounts {
  dayCount: number;
  dayTotal: number;
  monthCount: number;
  monthTotal: number;
  averageTicket: number;
  paidTotal: number;
  pendingCount: number;
  pendingTotal: number;
  cancelledCount: number;
  cancelledTotal: number;
  totalCount: number;
  cancelRatio: number | null;
}

const PENDING_STATUS = new Set(["pending", "draft", "open", "aguardando", "pendente"]);
const CANCELLED_STATUS = new Set(["cancelled", "canceled", "cancelada", "cancelado"]);

/** Contagens simples sobre as métricas já apuradas pelo SalesService. */
export function countSales(
  metrics: BellaSalesMetricsLike | null | undefined,
  _options: BellaSalesOptions = {},
): SalesCounts {
  const breakdown = metrics?.breakdown ?? [];

  let pendingCount = 0;
  let pendingTotal = 0;
  let cancelledCount = 0;
  let cancelledTotal = 0;
  let totalCount = 0;

  for (const row of breakdown) {
    const status = String(row.status ?? "").trim().toLowerCase();
    totalCount += num(row.count);
    if (PENDING_STATUS.has(status)) {
      pendingCount += num(row.count);
      pendingTotal += num(row.total);
    }
    if (CANCELLED_STATUS.has(status)) {
      cancelledCount += num(row.count);
      cancelledTotal += num(row.total);
    }
  }

  return {
    dayCount: num(metrics?.dayCount),
    dayTotal: num(metrics?.dayTotal),
    monthCount: num(metrics?.monthCount),
    monthTotal: num(metrics?.monthTotal),
    averageTicket: num(metrics?.averageTicket),
    paidTotal: num(metrics?.paidTotal),
    pendingCount,
    pendingTotal,
    cancelledCount,
    cancelledTotal,
    totalCount,
    cancelRatio: totalCount > 0 ? cancelledCount / totalCount : null,
  };
}

function money(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

/** Formata um indicador de vendas para exibição. */
export function formatSalesMetric(metric: BellaSalesMetric): string {
  if (!metric.available || metric.value === null) return "—";
  if (metric.format === "currency") return money(metric.value);
  if (metric.format === "percent") {
    return `${(metric.value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  }
  return metric.value.toLocaleString("pt-BR");
}

/** Texto de uma comparação já calculada pelo motor de tendências. */
export function formatSalesTrend(trend: TrendComparison | null | undefined): string | null {
  if (!trend) return null;
  const current = money(trend.current);
  if (!trend.hasHistory || trend.deltaPercent === null) return current;
  const pct = Math.abs(trend.deltaPercent * 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  });
  const arrow = trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "=";
  return `${current} ${arrow} ${pct}%`;
}

/** Indicadores de vendas — leitura direta de dados já apurados. */
export function buildSalesMetrics(
  input: BellaSalesInput,
  options: BellaSalesOptions = {},
): BellaSalesMetric[] {
  const metrics = input.metrics ?? null;
  const has = Boolean(metrics);
  const c = countSales(metrics, options);
  const summary = input.summary ?? null;
  const margin = summary?.margin.available ? summary.margin.data : null;
  const profit = summary?.profit.available ? summary.profit.data : null;
  const customers = summary?.customers.available ? summary.customers.data : null;

  return [
    {
      id: "faturamento_hoje",
      label: "Faturamento hoje",
      value: has ? c.dayTotal : null,
      available: has,
      format: "currency",
      hint: "Vendas pagas do dia",
      link: salesLink("abrir_vendas"),
    },
    {
      id: "vendas_hoje",
      label: "Vendas hoje",
      value: has ? c.dayCount : null,
      available: has,
      format: "count",
      hint: "Pedidos pagos hoje",
      link: salesLink("abrir_vendas"),
    },
    {
      id: "faturamento_mes",
      label: "Faturamento do mês",
      value: has ? c.monthTotal : null,
      available: has,
      format: "currency",
      hint: "Acumulado do mês corrente",
      link: salesLink("abrir_relatorios"),
    },
    {
      id: "vendas_mes",
      label: "Vendas no mês",
      value: has ? c.monthCount : null,
      available: has,
      format: "count",
      hint: "Pedidos pagos no mês",
      link: salesLink("abrir_vendas"),
    },
    {
      id: "ticket_medio",
      label: "Ticket médio",
      value: has ? c.averageTicket : null,
      available: has,
      format: "currency",
      hint: "Faturamento do mês ÷ pedidos",
      link: salesLink("abrir_relatorios"),
    },
    {
      id: "margem_bruta",
      label: "Margem bruta",
      value: margin ? margin.grossMargin : null,
      available: Boolean(margin),
      format: "percent",
      hint: "Apurada pelo módulo contábil",
      link: salesLink("abrir_painel_executivo"),
    },
    {
      id: "lucro_liquido",
      label: "Lucro líquido",
      value: profit ? profit.netProfit : null,
      available: Boolean(profit),
      format: "currency",
      hint: "Resultado do período",
      link: salesLink("abrir_painel_executivo"),
    },
    {
      id: "vendas_pendentes",
      label: "Vendas pendentes",
      value: has ? c.pendingCount : null,
      available: has,
      format: "count",
      hint: "Aguardando conclusão ou pagamento",
      link: salesLink("abrir_vendas"),
    },
    {
      id: "vendas_canceladas",
      label: "Vendas canceladas",
      value: has ? c.cancelledCount : null,
      available: has,
      format: "count",
      hint: "Canceladas no período",
      link: salesLink("abrir_vendas"),
    },
    {
      id: "clientes_ativos",
      label: "Clientes ativos",
      value: customers ? customers.active : null,
      available: Boolean(customers),
      format: "count",
      hint: "Compraram no período",
      link: salesLink("abrir_clientes"),
    },
  ];
}

/** Detalhes de vendas (tendências, campeão de venda, melhor cliente). */
export function buildSalesDetails(input: BellaSalesInput): BellaSalesDetail[] {
  const summary = input.summary ?? null;
  const trends = summary?.trends.available ? summary.trends.data : null;
  const products = summary?.products.available ? summary.products.data : null;
  const customers = summary?.customers.available ? summary.customers.data : null;
  const best = products?.bestSellers[0] ?? null;
  const topCustomer = customers?.topCustomers[0] ?? null;

  const today = formatSalesTrend(trends?.todayVsYesterday);
  const month = formatSalesTrend(trends?.monthVsPreviousRevenue);

  return [
    {
      id: "tendencia_hoje",
      label: "Hoje vs. ontem",
      value: today,
      available: Boolean(today),
      hint: trends?.todayVsYesterday.label,
      link: salesLink("abrir_vendas"),
    },
    {
      id: "tendencia_mes",
      label: "Mês vs. mês anterior",
      value: month,
      available: Boolean(month),
      hint: trends?.monthVsPreviousRevenue.label,
      link: salesLink("abrir_relatorios"),
    },
    {
      id: "produto_mais_vendido",
      label: "Mais vendido",
      value: best ? best.name : null,
      available: Boolean(best),
      hint: best ? `${best.quantity.toLocaleString("pt-BR")} un.` : undefined,
      link: best ? salesProductLink(best.id) : salesLink("abrir_produtos"),
    },
    {
      id: "melhor_cliente",
      label: "Melhor cliente",
      value: topCustomer ? topCustomer.name : null,
      available: Boolean(topCustomer),
      hint: topCustomer ? money(topCustomer.revenue) : undefined,
      link: topCustomer ? salesCustomerLink(topCustomer.id) : salesLink("abrir_clientes"),
    },
  ];
}

/**
 * Alertas de vendas — derivados de estados que Vendas/Contábil já
 * registraram, somados às notificações proativas de categoria comercial.
 */
export function buildSalesAlerts(
  input: BellaSalesInput,
  options: BellaSalesOptions = {},
): BellaSalesAlert[] {
  const alerts: BellaSalesAlert[] = [];
  const metrics = input.metrics ?? null;
  const c = countSales(metrics, options);
  const summary = input.summary ?? null;
  const trends = summary?.trends.available ? summary.trends.data : null;
  const margin = summary?.margin.available ? summary.margin.data : null;
  const customers = summary?.customers.available ? summary.customers.data : null;
  const cancelLimit = options.cancelRatioLimit ?? 0.1;

  if (metrics && c.dayCount === 0) {
    alerts.push({
      id: "sem_vendas_hoje",
      severity: "critical",
      title: "Nenhuma venda hoje",
      message: "Ainda não há venda paga registrada no dia.",
      recommendation: "Confirme se os pedidos do dia foram lançados no PDV ou em Vendas.",
      source: "sales",
      link: salesLink("abrir_pdv"),
    });
  }

  if (trends?.monthVsPreviousRevenue.direction === "down") {
    alerts.push({
      id: "queda_faturamento",
      severity: "warning",
      title: "Faturamento em queda",
      message: `Receita do mês abaixo do mês anterior (${trends.monthVsPreviousRevenue.label}).`,
      recommendation: "Reative clientes e reforce a divulgação dos produtos campeões.",
      source: "sales",
      link: salesLink("abrir_clientes"),
    });
  }

  if (trends?.monthVsPreviousProfit.direction === "down") {
    alerts.push({
      id: "queda_lucro",
      severity: "warning",
      title: "Lucro em queda",
      message: `Lucro do mês abaixo do mês anterior (${trends.monthVsPreviousProfit.label}).`,
      recommendation: "Revise preços, descontos e custos antes de ampliar as vendas.",
      source: "sales",
      link: salesLink("abrir_produtos"),
    });
  }

  if (metrics && c.cancelRatio !== null && c.cancelRatio > cancelLimit) {
    alerts.push({
      id: "muitas_canceladas",
      severity: "warning",
      title: "Cancelamentos acima do normal",
      message: `${c.cancelledCount} venda(s) cancelada(s) no período.`,
      recommendation: "Revise os motivos de cancelamento junto à equipe de vendas.",
      source: "sales",
      link: salesLink("abrir_vendas"),
    });
  }

  if (metrics && c.pendingCount > 0) {
    alerts.push({
      id: "vendas_pendentes",
      severity: "info",
      title: "Vendas pendentes",
      message: `${c.pendingCount} venda(s) aguardando conclusão ou pagamento.`,
      recommendation: "Finalize ou cobre esses pedidos para não perder receita.",
      source: "sales",
      link: salesLink("abrir_vendas"),
    });
  }

  if (metrics && c.monthCount > 0 && c.averageTicket <= 0) {
    alerts.push({
      id: "ticket_baixo",
      severity: "info",
      title: "Ticket médio indisponível",
      message: "As vendas do mês não geraram ticket médio válido.",
      recommendation: "Confira os valores lançados nos pedidos do mês.",
      source: "sales",
      link: salesLink("abrir_relatorios"),
    });
  }

  if (margin && margin.grossMargin <= 0) {
    alerts.push({
      id: "margem_baixa",
      severity: "warning",
      title: "Margem bruta sem folga",
      message: "A margem bruta apurada está zerada ou negativa.",
      recommendation: "Revise a precificação antes de aumentar o volume vendido.",
      source: "sales",
      link: salesLink("abrir_produtos"),
    });
  }

  if (customers && customers.active === 0 && customers.total > 0) {
    alerts.push({
      id: "poucos_clientes",
      severity: "info",
      title: "Nenhum cliente comprou no período",
      message: `Base com ${customers.total} cliente(s) sem compra no período.`,
      recommendation: "Trabalhe reativação da base antes de buscar novos clientes.",
      source: "sales",
      link: salesLink("abrir_clientes"),
    });
  }

  const proactive = filterSalesNotifications(input.notifications ?? []).map<BellaSalesAlert>(
    (n) => ({
      id: n.id,
      severity:
        n.severity === "critical" ? "critical" : n.severity === "warning" ? "warning" : "info",
      title: n.title,
      message: n.message,
      recommendation: n.recommendation,
      source: "proactive",
      link: salesLinkForAction(n.action),
    }),
  );

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return [...alerts, ...proactive]
    .sort((a, b) => order[a.severity] - order[b.severity])
    .slice(0, Math.max(0, options.alertLimit ?? 6));
}

export function buildSalesRecommendations(
  insights: readonly AccountingInsight[],
  limit = 5,
): BellaSalesRecommendation[] {
  return filterSalesInsights(insights)
    .slice(0, Math.max(0, limit))
    .map((insight) => ({
      id: insight.id,
      title: insight.title,
      description: insight.description,
      recommendation: insight.recommendation,
      severity: insight.severity,
      category: insight.category,
      priority: insight.priority,
      link: salesLinkForAction(insight.action),
    }));
}

export function buildSalesHealth(
  summary: AccountingSummary | null | undefined,
): BellaSalesHealth | null {
  const health = summary?.health.available ? summary.health.data : null;
  if (!health) return null;
  return {
    level: health.level,
    score: health.score,
    label: healthLabel(health),
    reasons: health.warnings ?? [],
  };
}

/** View model completo do painel "Bella Vendas". */
export function buildBellaSalesView(
  input: BellaSalesInput,
  options: BellaSalesOptions = {},
): BellaSalesView {
  const now = options.now ?? new Date().toISOString();
  const summary = input.summary ?? null;
  const generatedAt = options.now ?? summary?.generatedAt ?? now;
  const hasMetrics = Boolean(input.metrics);

  const insights = input.insights ?? (summary ? buildAccountingInsights(summary) : []);
  const notifications =
    input.notifications ?? (summary ? buildBellaNotifications({ summary, insights }) : []);

  const missing: string[] = [];
  if (!hasMetrics) missing.push("métricas de vendas");
  if (!summary) missing.push("resumo contábil");

  return {
    available: hasMetrics || Boolean(summary),
    generatedAt,
    metrics: buildSalesMetrics(input, options),
    details: buildSalesDetails(input),
    health: buildSalesHealth(summary),
    alerts: buildSalesAlerts({ ...input, insights, notifications }, { ...options, now }),
    recommendations: buildSalesRecommendations(insights, options.recommendationLimit ?? 5),
    missing,
  };
}
