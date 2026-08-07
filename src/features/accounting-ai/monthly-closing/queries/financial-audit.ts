import { buildFinancialAdvice } from "../../advisor/engine";
import { formatCurrency } from "@/lib/format";
import { 
  AccountingSummary, 
  ProviderResult, 
  CashSnapshot, 
  RevenueSnapshot, 
  ProfitAnalysis 
} from "../../types";
import { 
  MonthlyClosingAudit, 
  MonthlyClosingChecklistItem, 
  MonthlyClosingHealthScore 
} from "../types";

/**
 * Motor de Auditoria Financeira do Fechamento Mensal (Sprint 8.3B).
 * 
 * LEITURA PURA: Consome o AccountingSummary e FinancialAdvice para gerar
 * o checklist, score e resumo financeiro.
 */
export function auditFinancialClosing(
  summary: AccountingSummary,
  month: string
): MonthlyClosingAudit {
  // Reutiliza o Advisor Engine para ter as mesmas regras de risco e reserva
  const advice = buildFinancialAdvice({
    summary,
    cash: summary.cash.data,
    cashFlow: summary.cashFlow.data,
    taxes: summary.taxes.data,
    payroll: summary.payroll.data,
    health: summary.health.data,
  });

  const cash = summary.cash.data;
  const dre = summary.revenue.data;
  const profit = summary.profit.data;

  const checklist: MonthlyClosingChecklistItem[] = [];

  // 1. Contas a Pagar e Vencidas
  if (cash) {
    if (cash.payable > 0) {
      checklist.push({
        id: "fin_payable",
        domain: "finance",
        title: "Contas a Pagar",
        status: cash.payable > cash.currentBalance ? "warning" : "success",
        message: `Existem ${formatCurrency(cash.payable)} em contas a pagar abertas.`
      });
    }

    if (cash.receivableOverdue > 0) {
      checklist.push({
        id: "fin_overdue_rec",
        domain: "finance",
        title: "Recebíveis Vencidos",
        status: "error",
        message: `Atenção: ${formatCurrency(cash.receivableOverdue)} em recebíveis estão vencidos.`
      });
    }

    // 2. Caixa Negativo / Saldo
    if (cash.currentBalance < 0) {
      checklist.push({
        id: "fin_negative_cash",
        domain: "finance",
        title: "Saldo de Caixa",
        status: "error",
        message: "O saldo de caixa atual está negativo."
      });
    } else if (cash.currentBalance < (cash.payable + (summary.taxes.data?.taxAmount ?? 0))) {
       checklist.push({
        id: "fin_low_liquidity",
        domain: "finance",
        title: "Liquidez Imediata",
        status: "warning",
        message: "O caixa disponível não cobre os compromissos imediatos (A Pagar + Impostos)."
      });
    }
  }

  // 3. Lucro Líquido
  if (profit) {
    if (profit.netProfit < 0) {
      checklist.push({
        id: "fin_net_loss",
        domain: "finance",
        title: "Lucro Líquido",
        status: "error",
        message: `O mês encerrou com prejuízo líquido de ${formatCurrency(Math.abs(profit.netProfit))}.`
      });
    } else {
      checklist.push({
        id: "fin_net_profit",
        domain: "finance",
        title: "Lucro Líquido",
        status: "success",
        message: `Lucro líquido positivo de ${formatCurrency(profit.netProfit)}.`
      });
    }
  }

  // Score Financeiro (0-100)
  // Baseado no score do Advisor (que já considera caixa, reserva e risco)
  // Invertemos o risco (risco alto = score baixo)
  const baseScore = summary.health.data?.score ?? (100 - advice.risk.score);
  
  const healthScore: MonthlyClosingHealthScore = {
    score: baseScore,
    level: baseScore >= 90 ? "Exelente" : baseScore >= 70 ? "Boa" : baseScore >= 40 ? "Atenção" : "Crítica",
    label: advice.message
  };

  // Timeline (Eventos Financeiros)
  const timeline = [];
  if (cash && cash.receivableOverdue > 0) {
    timeline.push({
      date: new Date().toISOString(),
      domain: "finance",
      event: `Acúmulo de ${formatCurrency(cash.receivableOverdue)} em recebíveis vencidos.`,
      type: "error" as const
    });
  }
  if (profit && profit.netProfit > 0) {
     timeline.push({
      date: new Date().toISOString(),
      domain: "finance",
      event: `Fechamento operacional com lucro de ${formatCurrency(profit.netProfit)}.`,
      type: "success" as const
    });
  }

  return {
    month,
    healthScore,
    checklist,
    summary: {
      monthSummary: `Auditoria financeira de ${month}. ${advice.message}`,
      achievements: profit && profit.netProfit > 0 ? ["Lucro líquido positivo"] : [],
      problems: checklist.filter(i => i.status === "error").map(i => i.message || i.title),
      biggestRisk: advice.risk.reasons[0] || "Sem riscos críticos identificados",
      biggestOpportunity: advice.withdrawal.safeAmount > 0 
        ? `Possibilidade de distribuição de até ${formatCurrency(advice.withdrawal.safeAmount)}.`
        : "Focar na recuperação de recebíveis vencidos.",
      finalRecommendation: advice.withdrawal.approved 
        ? "Saúde financeira estável para o fechamento."
        : "Ajuste as pendências financeiras antes de concluir o fechamento."
    },
    timeline
  };
}
