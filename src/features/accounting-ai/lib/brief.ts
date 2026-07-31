/**
 * Bella Contadora — Resumo executivo (texto determinístico).
 *
 * Todas as frases são montadas exclusivamente com valores vindos dos
 * providers. Se um dado não existir, a frase correspondente não aparece.
 */
import { formatCurrency } from "@/lib/format";
import type { AccountingSummary } from "../types";
import { healthLabel } from "./health";

export interface ExecutiveBrief {
  greeting: string;
  lines: string[];
  /** true quando nenhum provider trouxe dados. */
  empty: boolean;
}

export function greetingFor(reference = new Date()): string {
  const hour = reference.getHours();
  if (hour < 12) return "Bom dia.";
  if (hour < 18) return "Boa tarde.";
  return "Boa noite.";
}

export function buildExecutiveBrief(
  summary: AccountingSummary | undefined,
  reference = new Date(),
): ExecutiveBrief {
  const greeting = greetingFor(reference);
  if (!summary) return { greeting, lines: [], empty: true };

  const lines: string[] = [];

  const today = summary.today.data;
  if (today) {
    lines.push(
      today.count > 0
        ? `Hoje sua empresa faturou ${formatCurrency(today.total)} em ${today.count} venda(s).`
        : "Ainda não há vendas registradas hoje.",
    );
  }

  const cash = summary.cash.data;
  if (cash) {
    lines.push(`Você possui ${formatCurrency(cash.currentBalance)} em caixa.`);
    if (cash.payable > 0) {
      lines.push(`Existem ${formatCurrency(cash.payable)} em contas a pagar.`);
    }
    if (cash.receivableOverdue > 0) {
      lines.push(`Há ${formatCurrency(cash.receivableOverdue)} a receber já vencidos.`);
    }
  }

  const ticket = summary.ticket.data;
  if (ticket && ticket.salesCount > 0) {
    lines.push(`Seu ticket médio é ${formatCurrency(ticket.averageTicket)}.`);
  }

  const champion = summary.products.data?.bestSellers[0];
  if (champion) {
    lines.push(`O produto campeão é ${champion.name} (${formatCurrency(champion.revenue)}).`);
  }

  const profit = summary.profit.data;
  if (profit) {
    lines.push(
      profit.netProfit >= 0
        ? `O resultado do período é positivo: ${formatCurrency(profit.netProfit)}.`
        : `O resultado do período está negativo em ${formatCurrency(Math.abs(profit.netProfit))}.`,
    );
  }

  const health = summary.health.data;
  if (health) {
    lines.push(`Saúde financeira: ${healthLabel(health)} (${health.score}/100).`);
  }

  return { greeting, lines, empty: lines.length === 0 };
}
