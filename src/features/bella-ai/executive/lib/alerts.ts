/**
 * Alertas executivos automáticos.
 *
 * Derivados dos insights e do risco já calculados — sem novas regras.
 */

import type {
  ExecutiveAlert,
  ExecutiveInsight,
  ExecutiveRiskReport,
  ExecutiveSnapshot,
} from "../types";
import { safeDiv, pctChange } from "./normalize";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const CATEGORY_BY_INSIGHT: Record<string, ExecutiveAlert["category"]> = {
  revenue_drop: "receita",
  profit_drop: "receita",
  margin_drop: "margem",
  cogs_rise: "margem",
  expense_rise: "margem",
  cash_below_minimum: "caixa",
  stale_inventory: "estoque",
  no_turnover_products: "estoque",
  negative_margin_products: "margem",
  delinquent_customers: "clientes",
  purchases_above_average: "caixa",
};

export function buildExecutiveAlerts(
  s: ExecutiveSnapshot,
  insights: ExecutiveInsight[],
  risk: ExecutiveRiskReport,
): ExecutiveAlert[] {
  const alerts: ExecutiveAlert[] = insights
    .filter((i) => i.severity !== "info")
    .map((i) => ({ ...i, category: CATEGORY_BY_INSIGHT[i.id] ?? "receita" }));

  // Mudança de faixa tributária
  if (s.tax.limitUsagePct >= 80) {
    alerts.push({
      id: "tax_bracket_change",
      title: "Mudança de faixa tributária à vista",
      description: `O RBT12 (${BRL.format(s.tax.rbt12)}) já consome ${s.tax.limitUsagePct.toFixed(1)}% do limite. A alíquota efetiva tende a subir.`,
      severity: s.tax.limitUsagePct >= 95 ? "critical" : "warning",
      category: "tributos",
      metric: s.tax.limitUsagePct,
    });
  }

  // Fluxo de caixa negativo projetado no período
  const flow = s.cash.receivable - s.cash.payable;
  if (flow < 0) {
    alerts.push({
      id: "negative_cash_flow",
      title: "Fluxo de caixa negativo",
      description: `As obrigações (${BRL.format(s.cash.payable)}) superam os recebíveis (${BRL.format(s.cash.receivable)}).`,
      severity: Math.abs(flow) > s.cash.available ? "critical" : "warning",
      category: "caixa",
      metric: flow,
    });
  }

  // Capital de giro insuficiente
  const workingCapital = s.cash.available + s.cash.receivable + s.inventory.value - s.cash.payable;
  if (workingCapital < 0) {
    alerts.push({
      id: "working_capital",
      title: "Capital de giro insuficiente",
      description: `O capital de giro está negativo em ${BRL.format(Math.abs(workingCapital))}.`,
      severity: "critical",
      category: "capital",
      metric: workingCapital,
    });
  }

  // Queda de caixa versus consumo diário
  const dailyExpenses = safeDiv(s.dre.operatingExpenses + s.dre.cogs, 30);
  if (dailyExpenses > 0 && safeDiv(s.cash.available, dailyExpenses) < 7) {
    alerts.push({
      id: "cash_drop",
      title: "Queda crítica de caixa",
      description: "O caixa disponível cobre menos de 7 dias de operação.",
      severity: "critical",
      category: "caixa",
    });
  }

  // Reforço do risco global
  if (risk.overallScore < 40) {
    alerts.push({
      id: "overall_risk",
      title: "Risco global elevado",
      description: `Score executivo em ${risk.overallScore}/100. Priorize as recomendações urgentes.`,
      severity: "critical",
      category: "capital",
      metric: risk.overallScore,
    });
  }

  // Queda de receita já coberta por insight, mas garantimos a categoria
  const revenueDelta = pctChange(s.dre.grossRevenue, s.previousDre.grossRevenue);
  if (revenueDelta <= -25 && !alerts.some((a) => a.id === "revenue_drop")) {
    alerts.push({
      id: "revenue_drop",
      title: "Queda acentuada de receita",
      description: `Receita ${revenueDelta.toFixed(1)}% abaixo do período anterior.`,
      severity: "critical",
      category: "receita",
      metric: revenueDelta,
    });
  }

  return alerts;
}
