/**
 * Bella Contadora — regras de interpretação (funções puras).
 *
 * Cada regra recebe o `AccountingSummary` já produzido pelos providers e
 * devolve no máximo um `AccountingInsight`. Nenhuma regra recalcula imposto,
 * margem, estoque ou saldo: apenas lê e interpreta o que os motores
 * existentes entregaram. Quando falta base de comparação, o insight informa
 * explicitamente "Histórico insuficiente." — nunca estima.
 */
import { formatCurrency } from "@/lib/format";
import type { AccountingSummary, TrendComparison } from "../types";
import {
  INSUFFICIENT_HISTORY,
  computePriority,
  formatPercent,
  trendOf,
} from "./helpers";
import type {
  AccountingInsight,
  InsightActionId,
  InsightCategory,
  InsightEngineOptions,
  InsightSeverity,
  InsightSourceProvider,
} from "./types";

const ACTION_LABELS: Record<InsightActionId, string> = {
  comprar_estoque: "Comprar estoque",
  cobrar_cliente: "Cobrar cliente",
  revisar_preco: "Revisar preço",
  reduzir_despesas: "Reduzir despesas",
  aumentar_divulgacao: "Aumentar divulgação",
  negociar_prazos: "Negociar prazos",
  reativar_cliente: "Reativar cliente",
  revisar_mix: "Revisar mix de produtos",
  manter_ritmo: "Manter o ritmo",
  acompanhar: "Acompanhar",
};

interface MakeInput {
  id: string;
  severity: InsightSeverity;
  category: InsightCategory;
  title: string;
  description: string;
  recommendation: string;
  action: InsightActionId;
  sourceProvider: InsightSourceProvider;
  magnitude?: number | null;
  createdAt: string;
}

function make(input: MakeInput): AccountingInsight {
  return {
    id: input.id,
    severity: input.severity,
    category: input.category,
    title: input.title,
    description: input.description,
    recommendation: input.recommendation,
    priority: computePriority(input.severity, input.magnitude),
    action: { id: input.action, label: ACTION_LABELS[input.action] },
    sourceProvider: input.sourceProvider,
    createdAt: input.createdAt,
  };
}

export interface RuleContext {
  summary: AccountingSummary;
  options: InsightEngineOptions;
  createdAt: string;
}

export type InsightRule = (ctx: RuleContext) => AccountingInsight | null;

/** Variação mínima (%) para considerar movimento relevante. */
const RELEVANT_PCT = 5;
/** Margem líquida considerada saudável (%). */
const HEALTHY_MARGIN = 10;
/** Dias de cobertura de caixa considerados confortáveis. */
const HEALTHY_CASH_DAYS = 30;

function historyless(
  ctx: RuleContext,
  id: string,
  category: InsightCategory,
  title: string,
  sourceProvider: InsightSourceProvider,
): AccountingInsight {
  return make({
    id,
    severity: "info",
    category,
    title,
    description: INSUFFICIENT_HISTORY,
    recommendation: "Continue registrando as operações para habilitar a comparação.",
    action: "acompanhar",
    sourceProvider,
    createdAt: ctx.createdAt,
  });
}

// ─────────────────────────── Receita ───────────────────────────

export const receitaRule: InsightRule = (ctx) => {
  const trend: TrendComparison | undefined =
    ctx.summary.trends.data?.monthVsPreviousRevenue;
  if (!trend) return null;
  if (!trend.hasHistory || trend.deltaPercent == null) {
    return historyless(ctx, "receita_sem_historico", "receita", "Receita do período", "trends");
  }
  const pct = trend.deltaPercent;
  if (pct >= RELEVANT_PCT) {
    return make({
      id: "receita_aumentou",
      severity: "success",
      category: "receita",
      title: "Receita em crescimento",
      description: `Sua receita aumentou ${formatPercent(pct)} em relação ao período anterior.`,
      recommendation: "Reforce o que está funcionando: mantenha estoque e divulgação dos itens em alta.",
      action: "manter_ritmo",
      sourceProvider: "trends",
      magnitude: pct,
      createdAt: ctx.createdAt,
    });
  }
  if (pct <= -RELEVANT_PCT) {
    return make({
      id: "receita_caiu",
      severity: "warning",
      category: "receita",
      title: "Receita em queda",
      description: `Sua receita caiu ${formatPercent(pct)} em relação ao período anterior.`,
      recommendation: "Avalie campanhas de divulgação e reative clientes sem compras recentes.",
      action: "aumentar_divulgacao",
      sourceProvider: "trends",
      magnitude: pct,
      createdAt: ctx.createdAt,
    });
  }
  return make({
    id: "receita_estavel",
    severity: "info",
    category: "receita",
    title: "Receita estável",
    description: `A receita variou ${formatPercent(pct)} em relação ao período anterior.`,
    recommendation: "Sem ação imediata: acompanhe a evolução na próxima semana.",
    action: "acompanhar",
    sourceProvider: "trends",
    magnitude: pct,
    createdAt: ctx.createdAt,
  });
};

// ──────────────────────────── Lucro ────────────────────────────

export const lucroRule: InsightRule = (ctx) => {
  const trend = ctx.summary.trends.data?.monthVsPreviousProfit;
  if (!trend) return null;
  if (!trend.hasHistory || trend.deltaPercent == null) {
    return historyless(ctx, "lucro_sem_historico", "lucro", "Lucro do período", "trends");
  }
  const pct = trend.deltaPercent;
  if (pct >= RELEVANT_PCT) {
    return make({
      id: "lucro_aumentou",
      severity: "success",
      category: "lucro",
      title: "Lucro em alta",
      description: `Seu lucro cresceu ${formatPercent(pct)} em relação ao período anterior.`,
      recommendation: "Considere reservar parte do resultado como capital de giro.",
      action: "manter_ritmo",
      sourceProvider: "trends",
      magnitude: pct,
      createdAt: ctx.createdAt,
    });
  }
  if (pct <= -RELEVANT_PCT) {
    return make({
      id: "lucro_caiu",
      severity: "warning",
      category: "lucro",
      title: "Lucro em queda",
      description: `Seu lucro caiu ${formatPercent(pct)} em relação ao período anterior.`,
      recommendation: "Revise despesas operacionais e a precificação dos itens de maior giro.",
      action: "reduzir_despesas",
      sourceProvider: "trends",
      magnitude: pct,
      createdAt: ctx.createdAt,
    });
  }
  return null;
};

export const margemRule: InsightRule = (ctx) => {
  const margin = ctx.summary.margin.data ?? null;
  if (!margin) return null;
  if (margin.netMargin >= HEALTHY_MARGIN) return null;
  const severity: InsightSeverity = margin.netMargin < 0 ? "critical" : "warning";
  return make({
    id: "margem_abaixo_media",
    severity,
    category: "lucro",
    title: "Margem líquida abaixo do saudável",
    description:
      margin.netMargin < 0
        ? `Sua margem líquida está negativa em ${formatPercent(margin.netMargin)}.`
        : `Sua margem líquida está em ${formatPercent(margin.netMargin)}, abaixo dos ${HEALTHY_MARGIN}% de referência.`,
    recommendation: "Revise preços e custos dos produtos com maior participação nas vendas.",
    action: "revisar_preco",
    sourceProvider: "margin",
    magnitude: HEALTHY_MARGIN - margin.netMargin,
    createdAt: ctx.createdAt,
  });
};

// ──────────────────────────── Caixa ────────────────────────────

/** Cobertura de caixa em dias, a partir das despesas já apuradas. */
export function cashCoverageDays(
  balance: number,
  totalExpenses: number,
  periodDays = 30,
): number | null {
  if (!Number.isFinite(balance) || totalExpenses <= 0 || periodDays <= 0) return null;
  const dailyBurn = totalExpenses / periodDays;
  if (dailyBurn <= 0) return null;
  return Math.floor(balance / dailyBurn);
}

export const caixaRule: InsightRule = (ctx) => {
  const cash = ctx.summary.cash.data ?? null;
  if (!cash) return null;
  const expenses = ctx.summary.expenses.data ?? null;
  const days = expenses
    ? cashCoverageDays(cash.currentBalance, expenses.totalExpenses)
    : null;

  if (cash.currentBalance < 0) {
    return make({
      id: "caixa_negativo",
      severity: "critical",
      category: "caixa",
      title: "Caixa negativo",
      description: `Seu saldo em caixa está negativo em ${formatCurrency(Math.abs(cash.currentBalance))}.`,
      recommendation: "Priorize recebimentos em atraso e renegocie os vencimentos mais próximos.",
      action: "cobrar_cliente",
      sourceProvider: "cash",
      magnitude: 50,
      createdAt: ctx.createdAt,
    });
  }

  if (days == null) {
    return make({
      id: "caixa_sem_base",
      severity: "info",
      category: "caixa",
      title: "Caixa disponível",
      description: `Você possui ${formatCurrency(cash.currentBalance)} em caixa. ${INSUFFICIENT_HISTORY}`,
      recommendation: "Registre as despesas do período para projetar a cobertura de caixa.",
      action: "acompanhar",
      sourceProvider: "cash",
      createdAt: ctx.createdAt,
    });
  }

  if (days >= HEALTHY_CASH_DAYS) {
    return make({
      id: "caixa_saudavel",
      severity: "success",
      category: "caixa",
      title: "Caixa saudável",
      description: `O caixa suporta aproximadamente ${days} dias mantendo o ritmo atual de despesas.`,
      recommendation: "Mantenha a reserva e avalie antecipar compras com desconto.",
      action: "manter_ritmo",
      sourceProvider: "cash",
      magnitude: 10,
      createdAt: ctx.createdAt,
    });
  }

  return make({
    id: "caixa_atencao",
    severity: days <= 7 ? "critical" : "warning",
    category: "caixa",
    title: "Caixa em atenção",
    description: `O caixa suporta aproximadamente ${days} dias mantendo o ritmo atual de despesas.`,
    recommendation: "Reduza despesas não essenciais e acelere a cobrança de recebíveis.",
    action: "reduzir_despesas",
    sourceProvider: "cash",
    magnitude: (HEALTHY_CASH_DAYS - days) * 2,
    createdAt: ctx.createdAt,
  });
};

// ────────────────────────── Financeiro ──────────────────────────

export const contasVencendoRule: InsightRule = (ctx) => {
  const cash = ctx.summary.cash.data ?? null;
  if (!cash || cash.payable <= 0) return null;
  const cobre = cash.currentBalance >= cash.payable;
  return make({
    id: "contas_vencendo",
    severity: cobre ? "info" : "warning",
    category: "financeiro",
    title: "Contas a pagar em aberto",
    description: cobre
      ? `Existem ${formatCurrency(cash.payable)} em contas a pagar, cobertos pelo saldo atual.`
      : `Existem ${formatCurrency(cash.payable)} em contas a pagar e o saldo atual é de ${formatCurrency(cash.currentBalance)}.`,
    recommendation: cobre
      ? "Programe os pagamentos para preservar o fluxo da semana."
      : "Negocie prazos com fornecedores e priorize os vencimentos críticos.",
    action: cobre ? "acompanhar" : "negociar_prazos",
    sourceProvider: "cash",
    magnitude: cobre ? 0 : 20,
    createdAt: ctx.createdAt,
  });
};

export const inadimplenciaRule: InsightRule = (ctx) => {
  const cash = ctx.summary.cash.data ?? null;
  if (!cash || cash.receivableOverdue <= 0) return null;
  const share = cash.receivable > 0 ? (cash.receivableOverdue / cash.receivable) * 100 : 0;
  const severity: InsightSeverity = share >= 30 ? "critical" : "warning";
  return make({
    id: "contas_em_atraso",
    severity,
    category: "financeiro",
    title: "Recebíveis em atraso",
    description:
      share > 0
        ? `Há ${formatCurrency(cash.receivableOverdue)} vencidos, ${formatPercent(share)} do total a receber.`
        : `Há ${formatCurrency(cash.receivableOverdue)} a receber já vencidos.`,
    recommendation: "Acione os clientes inadimplentes e ofereça condições de quitação.",
    action: "cobrar_cliente",
    sourceProvider: "cash",
    magnitude: share,
    createdAt: ctx.createdAt,
  });
};

// ─────────────────────────── Ticket ───────────────────────────

export const ticketRule: InsightRule = (ctx) => {
  const ticket = ctx.summary.ticket.data ?? null;
  if (!ticket) return null;
  const previous = ctx.options.previousAverageTicket ?? null;
  const trend = trendOf(ticket.averageTicket, previous);
  if (!trend.hasHistory || trend.deltaPercent == null) {
    return historyless(ctx, "ticket_sem_historico", "receita", "Ticket médio", "ticket");
  }
  const pct = trend.deltaPercent;
  if (pct >= RELEVANT_PCT) {
    return make({
      id: "ticket_subindo",
      severity: "success",
      category: "receita",
      title: "Ticket médio em alta",
      description: `Seu ticket médio subiu ${formatPercent(pct)} e está em ${formatCurrency(ticket.averageTicket)}.`,
      recommendation: "Mantenha as sugestões de venda casada que estão funcionando no PDV.",
      action: "manter_ritmo",
      sourceProvider: "ticket",
      magnitude: pct,
      createdAt: ctx.createdAt,
    });
  }
  if (pct <= -RELEVANT_PCT) {
    return make({
      id: "ticket_caindo",
      severity: "warning",
      category: "receita",
      title: "Ticket médio em queda",
      description: `Seu ticket médio caiu ${formatPercent(pct)} e está em ${formatCurrency(ticket.averageTicket)}.`,
      recommendation: "Revise o mix ofertado e incentive itens complementares na venda.",
      action: "revisar_mix",
      sourceProvider: "ticket",
      magnitude: pct,
      createdAt: ctx.createdAt,
    });
  }
  return null;
};

// ────────────────────────── Produtos ──────────────────────────

export const produtoCampeaoRule: InsightRule = (ctx) => {
  const best = ctx.summary.products.data?.bestSellers?.[0];
  if (!best) return null;
  return make({
    id: "produto_campeao",
    severity: "success",
    category: "produtos",
    title: "Produto campeão do período",
    description: `${best.name} lidera as vendas com ${best.quantity} unidade(s) e ${formatCurrency(best.revenue)}.`,
    recommendation: "Garanta estoque suficiente para não perder vendas do item mais procurado.",
    action: "comprar_estoque",
    sourceProvider: "products",
    magnitude: 10,
    createdAt: ctx.createdAt,
  });
};

export const semGiroRule: InsightRule = (ctx) => {
  const inventory = ctx.summary.inventory.data ?? null;
  const stagnant = ctx.summary.products.data?.stagnant ?? [];
  const total = inventory?.stagnantCount ?? stagnant.length;
  if (!total) return null;
  return make({
    id: "produtos_sem_giro",
    severity: "warning",
    category: "produtos",
    title: "Produtos sem giro",
    description: `Existem ${total} produto(s) sem venda no período monitorado.`,
    recommendation: "Reprecifique ou crie uma campanha para liberar o capital parado.",
    action: "revisar_preco",
    sourceProvider: "inventory",
    magnitude: total,
    createdAt: ctx.createdAt,
  });
};

// ─────────────────────────── Estoque ───────────────────────────

export const estoqueBaixoRule: InsightRule = (ctx) => {
  const inventory = ctx.summary.inventory.data ?? null;
  if (!inventory || inventory.belowMinCount <= 0) return null;
  return make({
    id: "estoque_baixo",
    severity: inventory.belowMinCount >= 10 ? "critical" : "warning",
    category: "estoque",
    title: "Estoque abaixo do mínimo",
    description: `${inventory.belowMinCount} produto(s) estão abaixo do estoque mínimo configurado.`,
    recommendation: "Gere um pedido de compra para os itens críticos antes da ruptura.",
    action: "comprar_estoque",
    sourceProvider: "inventory",
    magnitude: inventory.belowMinCount * 2,
    createdAt: ctx.createdAt,
  });
};

export const capitalParadoRule: InsightRule = (ctx) => {
  const inventory = ctx.summary.inventory.data ?? null;
  if (!inventory || inventory.inventoryValue <= 0) return null;
  return make({
    id: "estoque_valor",
    severity: "info",
    category: "estoque",
    title: "Capital investido em estoque",
    description: `Há ${formatCurrency(inventory.inventoryValue)} em ${inventory.productCount} produto(s) no estoque.`,
    recommendation: "Compare o capital parado com o caixa disponível antes de novas compras.",
    action: "acompanhar",
    sourceProvider: "inventory",
    createdAt: ctx.createdAt,
  });
};

// ─────────────────────────── Clientes ───────────────────────────

export const clienteDestaqueRule: InsightRule = (ctx) => {
  const customers = ctx.summary.customers.data ?? null;
  const top = customers?.topCustomers?.[0];
  if (!top) return null;
  const revenue = ctx.summary.revenue.data?.netRevenue ?? 0;
  const share = revenue > 0 ? (top.revenue / revenue) * 100 : null;
  const concentrated = share != null && share >= 30;
  return make({
    id: "cliente_destaque",
    severity: concentrated ? "warning" : "success",
    category: "clientes",
    title: concentrated ? "Concentração de faturamento" : "Cliente destaque",
    description:
      share != null
        ? `O cliente ${top.name} representa ${formatPercent(share)} do faturamento (${formatCurrency(top.revenue)}).`
        : `O cliente ${top.name} é o maior comprador do período com ${formatCurrency(top.revenue)}.`,
    recommendation: concentrated
      ? "Amplie a base de clientes para reduzir a dependência de um único comprador."
      : "Ofereça um benefício de relacionamento para manter a recorrência.",
    action: concentrated ? "aumentar_divulgacao" : "manter_ritmo",
    sourceProvider: "customers",
    magnitude: share ?? 0,
    createdAt: ctx.createdAt,
  });
};

export const clienteInativoRule: InsightRule = (ctx) => {
  const customers = ctx.summary.customers.data ?? null;
  if (!customers || customers.total <= 0) return null;
  const inactive = Math.max(0, customers.total - customers.active);
  if (inactive <= 0) return null;
  const share = (inactive / customers.total) * 100;
  return make({
    id: "clientes_inativos",
    severity: share >= 50 ? "warning" : "info",
    category: "clientes",
    title: "Clientes sem compras recentes",
    description: `${inactive} de ${customers.total} cliente(s) estão sem compras no período (${formatPercent(share)}).`,
    recommendation: "Envie uma campanha de reativação para a base inativa.",
    action: "reativar_cliente",
    sourceProvider: "customers",
    magnitude: share,
    createdAt: ctx.createdAt,
  });
};

// ──────────────────────────── Fiscal ────────────────────────────

export const fiscalRule: InsightRule = (ctx) => {
  const taxes = ctx.summary.taxes.data ?? null;
  if (!taxes || taxes.taxAmount <= 0) return null;
  return make({
    id: "carga_fiscal",
    severity: taxes.effectiveRate >= 15 ? "warning" : "info",
    category: "fiscal",
    title: "Carga tributária do período",
    description: `Competência ${taxes.competence}: ${formatCurrency(taxes.taxAmount)} de imposto sobre ${formatCurrency(taxes.revenue)} (${formatPercent(taxes.effectiveRate)}).`,
    recommendation: "Considere a carga fiscal na formação de preço dos próximos produtos.",
    action: taxes.effectiveRate >= 15 ? "revisar_preco" : "acompanhar",
    sourceProvider: "taxes",
    magnitude: taxes.effectiveRate,
    createdAt: ctx.createdAt,
  });
};

/** Catálogo oficial de regras (ordem de avaliação estável). */
export const INSIGHT_RULES: InsightRule[] = [
  receitaRule,
  ticketRule,
  lucroRule,
  margemRule,
  caixaRule,
  contasVencendoRule,
  inadimplenciaRule,
  produtoCampeaoRule,
  semGiroRule,
  estoqueBaixoRule,
  capitalParadoRule,
  clienteDestaqueRule,
  clienteInativoRule,
  fiscalRule,
];
