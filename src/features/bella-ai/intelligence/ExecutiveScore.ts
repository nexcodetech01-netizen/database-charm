/**
 * Score executivo 0-100.
 *
 * Ponderação:
 *   vendas    35%
 *   financeiro 30%
 *   estoque    20%
 *   clientes   15%
 *
 * Quando não há meta cadastrada, usamos como baseline a média móvel
 * dos últimos 90 dias (calculada pelo Engine e passada aqui).
 */
import type { ExecutiveMetrics, ExecutiveScore, ScoreBand } from "./types";

const clamp = (v: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, v));

export interface ScoreBaseline {
  /** Faturamento esperado no mês (meta ou baseline). */
  revenueGoalMonth: number;
  /** Total de contas esperadas no mês (aberto + pagas). */
  totalExpectedBills: number;
  /** Contagem-alvo de novos clientes/mês. */
  newCustomersTarget: number;
  /** Total de produtos ativos (base para calcular ratio crítico). */
  activeProducts: number;
}

function toBand(score: number): ScoreBand {
  if (score >= 85) return "excelente";
  if (score >= 70) return "bom";
  if (score >= 50) return "atencao";
  return "critico";
}

export function buildScore(
  metrics: ExecutiveMetrics,
  baseline: ScoreBaseline,
): ExecutiveScore {
  const salesScore =
    baseline.revenueGoalMonth > 0
      ? clamp((metrics.revenue_month / baseline.revenueGoalMonth) * 100)
      : metrics.revenue_month > 0
        ? 60
        : 0;

  const financeScore =
    baseline.totalExpectedBills > 0
      ? clamp(100 - (metrics.overdue_bills_amount / baseline.totalExpectedBills) * 100)
      : metrics.overdue_bills_count === 0
        ? 100
        : 50;

  const stockScore =
    baseline.activeProducts > 0
      ? clamp(100 - (metrics.critical_stock_count / baseline.activeProducts) * 100)
      : 100;

  const customersScore =
    baseline.newCustomersTarget > 0
      ? clamp((metrics.new_customers_month / baseline.newCustomersTarget) * 100)
      : metrics.new_customers_month > 0
        ? 70
        : 40;

  const score = Math.round(
    0.35 * salesScore +
      0.30 * financeScore +
      0.20 * stockScore +
      0.15 * customersScore,
  );

  return {
    score: clamp(score),
    band: toBand(score),
    breakdown: {
      sales: Math.round(salesScore),
      finance: Math.round(financeScore),
      stock: Math.round(stockScore),
      customers: Math.round(customersScore),
    },
  };
}
