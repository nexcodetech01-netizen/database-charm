/**
 * Insights automáticos da Bella Executive.
 *
 * Detecção pura sobre o snapshot: identifica quedas, aumentos e desvios
 * relevantes. Não recalcula regras de negócio.
 */

import type { ExecutiveInsight, ExecutiveSnapshot } from "../types";
import { pctChange, safeDiv } from "./normalize";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

/** Limiares de detecção — variação relevante a partir de 5%. */
export const INSIGHT_THRESHOLDS = {
  dropPct: 5,
  risePct: 10,
  minCashDays: 15,
  stalePurchaseFactor: 1.3,
};

export function detectExecutiveInsights(s: ExecutiveSnapshot): ExecutiveInsight[] {
  const out: ExecutiveInsight[] = [];
  const { dre, previousDre, cash, inventory, rankings } = s;
  const push = (i: ExecutiveInsight) => out.push(i);

  const revenueDelta = pctChange(dre.grossRevenue, previousDre.grossRevenue);
  if (revenueDelta <= -INSIGHT_THRESHOLDS.dropPct) {
    push({
      id: "revenue_drop",
      title: "Receita caiu",
      description: `A receita caiu ${pct(Math.abs(revenueDelta))} em relação ao período anterior (${BRL.format(dre.grossRevenue)} vs ${BRL.format(previousDre.grossRevenue)}).`,
      severity: revenueDelta <= -20 ? "critical" : "warning",
      metric: revenueDelta,
    });
  }

  const profitDelta = pctChange(dre.netProfit, previousDre.netProfit);
  if (dre.netProfit < previousDre.netProfit && Math.abs(profitDelta) >= INSIGHT_THRESHOLDS.dropPct) {
    push({
      id: "profit_drop",
      title: "Lucro caiu",
      description: `O lucro líquido recuou para ${BRL.format(dre.netProfit)} (${pct(profitDelta)} vs período anterior).`,
      severity: dre.netProfit < 0 ? "critical" : "warning",
      metric: profitDelta,
    });
  }

  const marginDelta = dre.netMargin - previousDre.netMargin;
  if (marginDelta <= -1) {
    push({
      id: "margin_drop",
      title: "Margem caiu",
      description: `A margem líquida caiu ${pct(Math.abs(marginDelta))} (de ${pct(previousDre.netMargin)} para ${pct(dre.netMargin)}).`,
      severity: dre.netMargin < 0 ? "critical" : "warning",
      metric: marginDelta,
    });
  }

  const cogsRatio = safeDiv(dre.cogs, dre.netRevenue) * 100;
  const prevCogsRatio = safeDiv(previousDre.cogs, previousDre.netRevenue) * 100;
  if (cogsRatio - prevCogsRatio >= 2) {
    push({
      id: "cogs_rise",
      title: "CMV aumentou",
      description: `O custo das mercadorias subiu de ${pct(prevCogsRatio)} para ${pct(cogsRatio)} da receita líquida.`,
      severity: "warning",
      metric: cogsRatio - prevCogsRatio,
    });
  }

  const expenseDelta = pctChange(dre.operatingExpenses, previousDre.operatingExpenses);
  if (expenseDelta >= INSIGHT_THRESHOLDS.risePct) {
    push({
      id: "expense_rise",
      title: "Despesa aumentou",
      description: `As despesas operacionais subiram ${pct(expenseDelta)} (${BRL.format(dre.operatingExpenses)}).`,
      severity: expenseDelta >= 30 ? "critical" : "warning",
      metric: expenseDelta,
    });
  }

  const dailyExpenses = safeDiv(dre.operatingExpenses + dre.cogs, 30);
  const cashDays = safeDiv(cash.available, dailyExpenses);
  if (dailyExpenses > 0 && cashDays < INSIGHT_THRESHOLDS.minCashDays) {
    push({
      id: "cash_below_minimum",
      title: "Caixa abaixo do mínimo",
      description: `O caixa disponível (${BRL.format(cash.available)}) cobre apenas ${cashDays.toFixed(0)} dias de operação.`,
      severity: cashDays < 7 ? "critical" : "warning",
      metric: cashDays,
    });
  }

  if (inventory.staleItems > 0) {
    push({
      id: "stale_inventory",
      title: "Estoque parado",
      description: `${inventory.staleItems} produto(s) com saldo em estoque não vendem há mais de 90 dias.`,
      severity: inventory.staleItems >= 20 ? "warning" : "info",
      metric: inventory.staleItems,
    });
  }

  const noTurnover = rankings.products.filter((p) => p.stock > 0 && p.quantitySold === 0);
  if (noTurnover.length > 0) {
    push({
      id: "no_turnover_products",
      title: "Produtos sem giro",
      description: `${noTurnover.length} produto(s) com estoque não tiveram nenhuma venda no período. Ex.: ${noTurnover.slice(0, 3).map((p) => p.name).join(", ")}.`,
      severity: "info",
      metric: noTurnover.length,
    });
  }

  const negativeMargin = rankings.products.filter((p) => p.revenue > 0 && p.profit < 0);
  if (negativeMargin.length > 0) {
    push({
      id: "negative_margin_products",
      title: "Produtos com margem negativa",
      description: `${negativeMargin.length} produto(s) venderam com prejuízo. Ex.: ${negativeMargin.slice(0, 3).map((p) => p.name).join(", ")}.`,
      severity: "critical",
      metric: negativeMargin.length,
    });
  }

  const delinquent = rankings.customers.filter((c) => c.overdueAmount > 0);
  if (delinquent.length > 0 || cash.overdueReceivable > 0) {
    const total = cash.overdueReceivable || delinquent.reduce((a, c) => a + c.overdueAmount, 0);
    push({
      id: "delinquent_customers",
      title: "Clientes inadimplentes",
      description: `${BRL.format(total)} em recebíveis vencidos${delinquent.length ? ` de ${delinquent.length} cliente(s)` : ""}.`,
      severity: total > cash.available ? "critical" : "warning",
      metric: total,
    });
  }

  const purchases = s.rankings.suppliers.filter((sp) => sp.purchasesCount > 0);
  if (purchases.length > 1) {
    const avg = purchases.reduce((a, p) => a + p.averageAmount, 0) / purchases.length;
    const above = purchases.filter((p) => p.averageAmount > avg * INSIGHT_THRESHOLDS.stalePurchaseFactor);
    if (above.length > 0) {
      push({
        id: "purchases_above_average",
        title: "Compras acima da média",
        description: `${above.length} fornecedor(es) com ticket de compra acima da média (${BRL.format(avg)}). Ex.: ${above.slice(0, 3).map((p) => p.name).join(", ")}.`,
        severity: "info",
        metric: above.length,
      });
    }
  }

  return out;
}
