/**
 * Bella Insight Builder
 *
 * Gera pequenas frases contextuais a partir dos eventos ativos, usando
 * apenas regras determinísticas. Sem IA, sem chamadas externas.
 */

import type { BellaEvent } from "../events";
import type { BellaInsightItem } from "./types";

interface Rule {
  id: string;
  match: (events: BellaEvent[]) => BellaInsightItem | null;
}

const RULES: Rule[] = [
  {
    id: "finance.overdue",
    match: (events) => {
      const overdue = events.filter((e) => e.type === "finance.invoice.overdue").length;
      if (overdue === 0) return null;
      return {
        id: "finance.overdue",
        tone: "negative",
        message: `Existem ${overdue} conta${overdue > 1 ? "s" : ""} vencida${overdue > 1 ? "s" : ""} aguardando cobrança.`,
      };
    },
  },
  {
    id: "inventory.critical",
    match: (events) => {
      const stock = events.filter(
        (e) => e.type === "inventory.min_stock_reached" || e.type === "inventory.out_of_stock",
      ).length;
      if (stock === 0) return null;
      return {
        id: "inventory.critical",
        tone: "negative",
        message: `${stock} produto${stock > 1 ? "s" : ""} em situação crítica de estoque.`,
      };
    },
  },
  {
    id: "inventory.slow_moving",
    match: (events) => {
      const slow = events.filter((e) => e.type === "inventory.slow_moving");
      if (slow.length === 0) return null;
      const value = slow.reduce((s, e) => s + (Number(e.payload?.inventoryValue) || 0), 0);
      return {
        id: "inventory.slow_moving",
        tone: "neutral",
        message: value > 0 
          ? `Você tem R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} imobilizados em ${slow.length} produtos sem giro.`
          : `Existem ${slow.length} produtos sem movimentação recente no estoque.`,
      };
    },
  },
  {
    id: "sales.trend",
    match: (events) => {
      const above = events.some((e) => e.type === "sales.above_average" || e.type === "sales.goal_reached");
      const decline = events.some((e) => e.type === "sales.decline" || e.type === "sales.average_ticket.drop");
      if (above && !decline) {
        return { id: "sales.trend", tone: "positive", message: "As vendas seguem acima da média recente." };
      }
      if (decline && !above) {
        return { id: "sales.trend", tone: "negative", message: "Detectada queda relevante nas vendas do período." };
      }
      return null;
    },
  },
  {
    id: "customers.retention",
    match: (events) => {
      const vip = events.some((e) => e.type === "customers.vip.inactive");
      const returned = events.some((e) => e.type === "customers.returned_to_buy");
      if (returned) {
        return { id: "customers.retention", tone: "positive", message: "Um cliente inativo voltou a comprar hoje." };
      }
      if (vip) {
        return { id: "customers.retention", tone: "neutral", message: "Há cliente VIP sem comprar há bastante tempo." };
      }
      return null;
    },
  },
  {
    id: "cashflow.negative",
    match: (events) => {
      const neg = events.some((e) => e.type === "finance.cashflow.negative");
      if (!neg) return null;
      return {
        id: "cashflow.negative",
        tone: "negative",
        message: "O caixa do período está negativo — revise despesas antes de novos compromissos.",
      };
    },
  },
  {
    id: "finance.expense.elevated",
    match: (events) => {
      const elevated = events.find((e) => e.type === "finance.expense.elevated");
      if (!elevated) return null;
      const amount = Number(elevated.payload?.current || 0);
      return {
        id: "finance.expense.elevated",
        tone: "negative",
        message: amount > 0
          ? `Identificada despesa elevada de R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} acima do padrão.`
          : "Identificada despesa acima do padrão no período.",
      };
    },
  },
  {
    id: "fiscal.nfe.rejected",
    match: (events) => {
      const rejected = events.filter((e) => e.type === "fiscal.nfe.rejected").length;
      if (rejected === 0) return null;
      return {
        id: "fiscal.nfe.rejected",
        tone: "negative",
        message: `Existem ${rejected} nota${rejected > 1 ? "s" : ""} fiscal${rejected > 1 ? "s" : ""} rejeitada${rejected > 1 ? "s" : ""} que precisa${rejected > 1 ? "m" : ""} de correção.`,
      };
    },
  },
  {
    id: "finance.accounting.margins",
    match: (events) => {
      const revenue = events.find((e) => e.type === "finance.revenue.above_average");
      if (!revenue) return null;
      return {
        id: "finance.accounting.margins",
        tone: "positive",
        message: "Margem de contribuição acima da meta para os principais grupos de produtos.",
      };
];

export function buildInsights(events: BellaEvent[]): BellaInsightItem[] {
  const out: BellaInsightItem[] = [];
  for (const rule of RULES) {
    const item = rule.match(events);
    if (item) out.push(item);
  }
  return out;
}
