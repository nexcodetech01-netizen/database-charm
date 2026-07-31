/**
 * Geração de insights — regras determinísticas em pt-BR.
 * Sem IA. Sem novos números — apenas transforma métricas em frases.
 */
import type {
  ComparisonResult,
  ExecutiveInsight,
  ExecutiveMetrics,
  InsightTone,
} from "./types";

const push = (
  list: ExecutiveInsight[],
  id: string,
  tone: InsightTone,
  message: string,
  extras?: Partial<ExecutiveInsight>,
) => {
  list.push({ id, tone, message, ...extras });
};

function fmtPct(pct: number): string {
  const abs = Math.abs(pct);
  return `${abs.toFixed(1).replace(".", ",")}%`;
}

export function buildInsights(
  metrics: ExecutiveMetrics,
  comparisons: readonly ComparisonResult[],
  previousMetrics?: ExecutiveMetrics,
): ExecutiveInsight[] {
  const out: ExecutiveInsight[] = [];

  const cmp = (k: ComparisonResult["key"]) =>
    comparisons.find((c) => c.key === k);

  const today = cmp("today_vs_yesterday");
  if (today) {
    if (today.direction === "up" && today.pct >= 5) {
      push(out, "sales_up_today", "positive",
        `As vendas cresceram ${fmtPct(today.pct)} em relação a ontem.`);
    } else if (today.direction === "down" && today.pct <= -5) {
      push(out, "sales_down_today", "negative",
        `As vendas caíram ${fmtPct(today.pct)} em relação a ontem.`);
    } else {
      push(out, "sales_flat_today", "neutral",
        "As vendas de hoje seguem em linha com ontem.");
    }
  }

  const week = cmp("week_vs_previous");
  if (week && Math.abs(week.pct) >= 5) {
    push(out, "sales_week", week.direction === "up" ? "positive" : "negative",
      week.direction === "up"
        ? `A semana está ${fmtPct(week.pct)} acima da anterior.`
        : `A semana está ${fmtPct(week.pct)} abaixo da anterior.`);
  }

  const month = cmp("month_vs_previous");
  if (month && Math.abs(month.pct) >= 5) {
    push(out, "sales_month", month.direction === "up" ? "positive" : "negative",
      month.direction === "up"
        ? `O faturamento do mês já supera o mês anterior em ${fmtPct(month.pct)}.`
        : `O faturamento do mês está ${fmtPct(month.pct)} abaixo do mês anterior.`);
  }

  if (previousMetrics) {
    if (metrics.avg_ticket_month < previousMetrics.avg_ticket_month * 0.95) {
      push(out, "ticket_down", "warning",
        "O ticket médio caiu nesta semana.");
    } else if (metrics.avg_ticket_month > previousMetrics.avg_ticket_month * 1.05) {
      push(out, "ticket_up", "positive",
        "O ticket médio subiu no período.");
    }

    if (metrics.critical_stock_count > previousMetrics.critical_stock_count) {
      push(out, "stock_worse", "negative",
        `O estoque crítico aumentou (${metrics.critical_stock_count} produtos).`);
    } else if (metrics.critical_stock_count < previousMetrics.critical_stock_count) {
      push(out, "stock_better", "positive", "O estoque crítico diminuiu.");
    }

    if (metrics.overdue_bills_count > previousMetrics.overdue_bills_count) {
      push(out, "overdue_up", "negative",
        "As contas vencidas aumentaram desde o último período.");
    } else if (
      metrics.overdue_bills_count < previousMetrics.overdue_bills_count
    ) {
      push(out, "overdue_down", "positive",
        "Você quitou contas vencidas — inadimplência caiu.");
    }
  } else {
    if (metrics.critical_stock_count > 0) {
      push(out, "stock_state", "warning",
        `Há ${metrics.critical_stock_count} produtos em estoque crítico.`);
    }
    if (metrics.overdue_bills_count > 0) {
      push(out, "overdue_state", "warning",
        `Você possui ${metrics.overdue_bills_count} contas vencidas em aberto.`);
    }
  }

  if (metrics.new_customers_month > 0) {
    push(out, "new_customers", "positive",
      `Você conquistou ${metrics.new_customers_month} novo(s) cliente(s) neste mês.`);
  }

  if (metrics.margin_month_pct > 0) {
    if (metrics.margin_month_pct < 15) {
      push(out, "margin_low", "warning",
        `A margem do mês está em ${fmtPct(metrics.margin_month_pct)} — abaixo do saudável.`);
    } else if (metrics.margin_month_pct >= 35) {
      push(out, "margin_high", "positive",
        `Excelente margem no mês: ${fmtPct(metrics.margin_month_pct)}.`);
    }
  }

  return out;
}
