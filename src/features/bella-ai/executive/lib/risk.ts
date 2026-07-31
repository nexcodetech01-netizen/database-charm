/**
 * Análise de risco executiva — score 0 (crítico) a 100 (saudável).
 *
 * Consolida sinais já produzidos pelos motores existentes em cinco
 * dimensões de risco. Nenhum cálculo contábil/tributário é refeito.
 */

import type {
  ExecutiveRisk,
  ExecutiveRiskReport,
  ExecutiveSeverity,
  ExecutiveSnapshot,
} from "../types";
import { pctChange, safeDiv } from "./normalize";

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

function severityOf(score: number): ExecutiveSeverity {
  if (score < 40) return "critical";
  if (score < 70) return "warning";
  return "info";
}

export function assessExecutiveRisk(s: ExecutiveSnapshot): ExecutiveRiskReport {
  const { dre, previousDre, cash, inventory, tax, balance } = s;
  const dailyExpenses = safeDiv(dre.operatingExpenses + dre.cogs, 30);
  const cashDays = dailyExpenses > 0 ? safeDiv(cash.available, dailyExpenses) : 90;

  // Risco financeiro — resultado, margem e endividamento.
  const financeReasons: string[] = [];
  let finance = 100;
  if (dre.netProfit < 0) { finance -= 40; financeReasons.push("Prejuízo no período."); }
  if (dre.netMargin < 5) { finance -= 15; financeReasons.push("Margem líquida abaixo de 5%."); }
  if (pctChange(dre.grossRevenue, previousDre.grossRevenue) < -10) {
    finance -= 20; financeReasons.push("Receita caiu mais de 10%.");
  }
  const debtRatio = safeDiv(balance.liabilities, balance.assets) * 100;
  if (debtRatio > 70) { finance -= 20; financeReasons.push("Endividamento acima de 70% do ativo."); }

  // Risco de caixa — cobertura, vencidos e saldo.
  const cashReasons: string[] = [];
  let cashScore = 100;
  if (cashDays < 30) { cashScore -= 20; cashReasons.push("Menos de 30 dias de cobertura de caixa."); }
  if (cashDays < 15) { cashScore -= 20; cashReasons.push("Menos de 15 dias de cobertura de caixa."); }
  if (cash.available <= 0) { cashScore -= 30; cashReasons.push("Sem saldo disponível em contas."); }
  if (cash.overduePayable > 0) { cashScore -= 15; cashReasons.push("Existem contas a pagar vencidas."); }
  if (cash.payable > cash.available + cash.receivable) {
    cashScore -= 20; cashReasons.push("Obrigações superiores ao caixa mais recebíveis.");
  }

  // Risco tributário — limite do Simples e reserva.
  const taxReasons: string[] = [];
  let taxScore = 100;
  if (tax.limitUsagePct >= 80) { taxScore -= 25; taxReasons.push("Uso do limite do Simples acima de 80%."); }
  if (tax.limitUsagePct >= 95) { taxScore -= 25; taxReasons.push("Risco de desenquadramento do Simples."); }
  if (tax.estimatedTax > cash.available) { taxScore -= 25; taxReasons.push("Tributos estimados maiores que o caixa disponível."); }
  if (!tax.regime) { taxScore -= 15; taxReasons.push("Perfil tributário não configurado."); }

  // Risco de estoque — parado, giro e capital imobilizado.
  const stockReasons: string[] = [];
  let stockScore = 100;
  const turnover = safeDiv(dre.cogs, inventory.value);
  if (inventory.value > 0 && turnover < 0.5) { stockScore -= 25; stockReasons.push("Giro de estoque abaixo de 0,5x no período."); }
  if (inventory.staleItems > 0) {
    stockScore -= Math.min(30, inventory.staleItems * 2);
    stockReasons.push(`${inventory.staleItems} produto(s) sem giro há 90 dias.`);
  }
  if (inventory.value > cash.available * 3 && inventory.value > 0) {
    stockScore -= 15; stockReasons.push("Capital imobilizado em estoque muito acima do caixa.");
  }

  // Risco operacional — dependência de clientes, inadimplência e produtos negativos.
  const opReasons: string[] = [];
  let opScore = 100;
  const topCustomer = s.rankings.customers[0];
  if (topCustomer && dre.grossRevenue > 0 && topCustomer.revenue / dre.grossRevenue > 0.4) {
    opScore -= 25; opReasons.push("Mais de 40% da receita concentrada em um único cliente.");
  }
  if (cash.overdueReceivable > 0) {
    opScore -= 15; opReasons.push("Recebíveis vencidos em aberto.");
  }
  const negative = s.rankings.products.filter((p) => p.revenue > 0 && p.profit < 0).length;
  if (negative > 0) { opScore -= Math.min(25, negative * 5); opReasons.push(`${negative} produto(s) vendidos com prejuízo.`); }
  if (s.salesCount === 0) { opScore -= 30; opReasons.push("Nenhuma venda registrada no período."); }

  const risks: ExecutiveRisk[] = [
    { key: "financeiro", label: "Risco financeiro", score: clamp(finance), severity: severityOf(clamp(finance)), reasons: financeReasons },
    { key: "caixa", label: "Risco de caixa", score: clamp(cashScore), severity: severityOf(clamp(cashScore)), reasons: cashReasons },
    { key: "tributario", label: "Risco tributário", score: clamp(taxScore), severity: severityOf(clamp(taxScore)), reasons: taxReasons },
    { key: "estoque", label: "Risco de estoque", score: clamp(stockScore), severity: severityOf(clamp(stockScore)), reasons: stockReasons },
    { key: "operacional", label: "Risco operacional", score: clamp(opScore), severity: severityOf(clamp(opScore)), reasons: opReasons },
  ];

  const overallScore = clamp(risks.reduce((a, r) => a + r.score, 0) / risks.length);

  return { risks, overallScore, severity: severityOf(overallScore) };
}
