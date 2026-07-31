/**
 * Alertas executivos — regras.
 * Baseados em métricas + comparações; nenhum novo IO.
 */
import type {
  ComparisonResult,
  ExecutiveAlert,
  ExecutiveMetrics,
} from "./types";

export function buildAlerts(
  metrics: ExecutiveMetrics,
  comparisons: readonly ComparisonResult[],
): ExecutiveAlert[] {
  const out: ExecutiveAlert[] = [];

  if (metrics.overdue_bills_count > 0) {
    out.push({
      id: "overdue",
      severity: metrics.overdue_bills_amount > 5000 ? "critical" : "warning",
      title: `${metrics.overdue_bills_count} conta(s) vencida(s)`,
      detail: `Total em atraso: R$ ${metrics.overdue_bills_amount.toFixed(2)}.`,
      targetRoute: "/financeiro",
    });
  }

  if (metrics.critical_stock_count > 0) {
    out.push({
      id: "critical_stock",
      severity: metrics.critical_stock_count >= 10 ? "critical" : "warning",
      title: `${metrics.critical_stock_count} produto(s) em estoque crítico`,
      detail: "Reposição recomendada para evitar rupturas de venda.",
      targetRoute: "/produtos",
    });
  }

  const today = comparisons.find((c) => c.key === "today_vs_yesterday");
  if (today && today.direction === "down" && today.pct <= -20) {
    out.push({
      id: "sales_drop",
      severity: "warning",
      title: "Queda expressiva nas vendas de hoje",
      detail: `Redução de ${Math.abs(today.pct).toFixed(1)}% em relação a ontem.`,
      targetRoute: "/vendas",
    });
  }

  const month = comparisons.find((c) => c.key === "month_vs_previous");
  if (month && month.direction === "down" && month.pct <= -20) {
    out.push({
      id: "month_drop",
      severity: "critical",
      title: "Faturamento do mês em queda acentuada",
      detail: `Redução de ${Math.abs(month.pct).toFixed(1)}% frente ao mês anterior.`,
      targetRoute: "/vendas",
    });
  }

  return out;
}
