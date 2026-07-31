/**
 * Projeções executivas (7 / 15 / 30 / 90 dias).
 *
 * Extrapolação linear simples sobre o desempenho já realizado, ajustada
 * pela tendência do período anterior. Não substitui nem altera os motores
 * financeiro/tributário — apenas projeta os valores por eles apurados.
 */

import type { ExecutiveForecastPoint, ExecutiveHorizon, ExecutiveSnapshot } from "../types";
import { safeDiv } from "./normalize";

export const HORIZONS: ExecutiveHorizon[] = [7, 15, 30, 90];

const PERIOD_DAYS = 30;
/** Fator de tendência limitado para evitar projeções irreais. */
export function trendFactor(current: number, previous: number): number {
  if (previous <= 0) return 1;
  const ratio = current / previous;
  return Math.min(Math.max(ratio, 0.5), 1.5);
}

export function buildExecutiveForecast(s: ExecutiveSnapshot): ExecutiveForecastPoint[] {
  const { dre, previousDre, cash, tax } = s;

  const factor = trendFactor(dre.grossRevenue, previousDre.grossRevenue);
  const dailyRevenue = safeDiv(dre.grossRevenue, PERIOD_DAYS) * factor;
  const netMarginRatio = safeDiv(dre.netProfit, dre.grossRevenue);
  const dailyProfit = dailyRevenue * netMarginRatio;
  const dailyExpenses = safeDiv(dre.operatingExpenses + dre.cogs, PERIOD_DAYS);
  const taxRate = tax.effectiveRate > 0 ? tax.effectiveRate / 100 : safeDiv(tax.estimatedTax, tax.monthRevenue);

  return HORIZONS.map((horizonDays) => {
    const revenue = dailyRevenue * horizonDays;
    const profit = dailyProfit * horizonDays;
    const taxes = revenue * taxRate;
    const inflow = revenue + Math.min(cash.receivable, (cash.receivable / 90) * horizonDays);
    const outflow = dailyExpenses * horizonDays + Math.min(cash.payable, (cash.payable / 90) * horizonDays) + taxes;
    const projectedCash = cash.available + inflow - outflow;
    return {
      horizonDays,
      revenue,
      cash: projectedCash,
      profit,
      taxes,
      workingCapital: projectedCash + cash.receivable - cash.payable,
    };
  });
}
