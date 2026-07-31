/**
 * Bella Contadora — regras proativas (funções puras).
 *
 * Cada regra lê APENAS dados já apurados (`AccountingSummary`,
 * `AccountingInsight[]`, `FinancialAdvice`, `FinancialHealth`) e devolve no
 * máximo uma notificação. Nenhuma regra recalcula imposto, margem, estoque
 * ou saldo, e nenhuma executa ação.
 */
import { formatCurrency } from "@/lib/format";
import { cashCoverageDays } from "../insights";
import { makeNotification } from "./helpers";
import { unavailableProviders } from "./providers";
import type { BellaNotification, ProactiveContext, ProactiveRule } from "./types";

/** Variação mínima (%) para considerar movimento relevante. */
const RELEVANT_PCT = 5;
/** Queda considerada severa. */
const SEVERE_PCT = 25;
/** Margem líquida saudável (%). */
const HEALTHY_MARGIN = 10;
/** Despesas sobre receita consideradas altas (%). */
const HIGH_EXPENSE_RATIO = 30;
/** Cobertura de caixa (dias). */
const CRITICAL_COVERAGE = 7;
const HEALTHY_COVERAGE = 30;
/** Antecedência (dias) para alertar imposto. */
const TAX_WINDOW_DAYS = 7;

function pct(value: number): string {
  return `${Math.abs(value).toFixed(1).replace(".", ",")}%`;
}

function daysUntil(dateIso: string, referenceIso: string): number | null {
  const due = Date.parse(`${dateIso.slice(0, 10)}T00:00:00Z`);
  const ref = Date.parse(`${referenceIso.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(due) || !Number.isFinite(ref)) return null;
  return Math.round((due - ref) / 86_400_000);
}

export const receitaCrescendoRule: ProactiveRule = (ctx) => {
  const t = ctx.summary.trends.data?.monthVsPreviousRevenue;
  if (!t || !t.hasHistory || t.deltaPercent == null) return null;
  if (t.direction !== "up" || t.deltaPercent < RELEVANT_PCT) return null;
  return makeNotification({
    id: "receita_crescendo",
    category: "receita",
    severity: "success",
    title: "Receita em crescimento",
    message: `A receita subiu ${pct(t.deltaPercent)} em relação ao período anterior (${formatCurrency(t.current)}).`,
    recommendation: "Mantenha o ritmo de vendas e garanta estoque para não perder demanda.",
    action: "manter_ritmo",
    magnitude: t.deltaPercent,
    createdAt: ctx.createdAt,
  });
};

export const receitaCaindoRule: ProactiveRule = (ctx) => {
  const t = ctx.summary.trends.data?.monthVsPreviousRevenue;
  if (!t || !t.hasHistory || t.deltaPercent == null) return null;
  if (t.direction !== "down" || Math.abs(t.deltaPercent) < RELEVANT_PCT) return null;
  const severe = Math.abs(t.deltaPercent) >= SEVERE_PCT;
  return makeNotification({
    id: "receita_caindo",
    category: "receita",
    severity: severe ? "critical" : "warning",
    title: "Receita em queda",
    message: `A receita caiu ${pct(t.deltaPercent)} frente ao período anterior (${formatCurrency(t.current)}).`,
    recommendation: "Revise divulgação, mix de produtos e retome contato com os clientes recorrentes.",
    action: "aumentar_divulgacao",
    magnitude: t.deltaPercent,
    createdAt: ctx.createdAt,
  });
};

export const lucroCaindoRule: ProactiveRule = (ctx) => {
  const t = ctx.summary.trends.data?.monthVsPreviousProfit;
  if (!t || !t.hasHistory || t.deltaPercent == null) return null;
  if (t.direction !== "down" || Math.abs(t.deltaPercent) < RELEVANT_PCT) return null;
  return makeNotification({
    id: "lucro_caindo",
    category: "lucro",
    severity: Math.abs(t.deltaPercent) >= SEVERE_PCT ? "critical" : "warning",
    title: "Lucro em queda",
    message: `O lucro recuou ${pct(t.deltaPercent)} em relação ao período anterior (${formatCurrency(t.current)}).`,
    recommendation: "Confira custos, descontos concedidos e preços praticados no período.",
    action: "revisar_preco",
    magnitude: t.deltaPercent,
    createdAt: ctx.createdAt,
  });
};

export const caixaCriticoRule: ProactiveRule = (ctx) => {
  const cash = ctx.summary.cash.data;
  if (!cash) return null;
  const expenses = ctx.summary.expenses.data;
  const coverage = expenses
    ? cashCoverageDays(cash.currentBalance, expenses.totalExpenses)
    : null;
  const negative = cash.currentBalance < 0;
  if (!negative && (coverage == null || coverage >= CRITICAL_COVERAGE)) return null;
  return makeNotification({
    id: "caixa_critico",
    category: "caixa",
    severity: "critical",
    title: negative ? "Caixa negativo" : "Caixa em nível crítico",
    message: negative
      ? `O saldo em caixa está negativo em ${formatCurrency(Math.abs(cash.currentBalance))}.`
      : `O caixa cobre apenas ${coverage} dia(s) de despesas (${formatCurrency(cash.currentBalance)}).`,
    recommendation: "Priorize recebimentos em atraso e renegocie os vencimentos mais próximos.",
    action: "cobrar_cliente",
    createdAt: ctx.createdAt,
  });
};

export const caixaSaudavelRule: ProactiveRule = (ctx) => {
  const cash = ctx.summary.cash.data;
  const expenses = ctx.summary.expenses.data;
  if (!cash || !expenses || cash.currentBalance <= 0) return null;
  const coverage = cashCoverageDays(cash.currentBalance, expenses.totalExpenses);
  if (coverage == null || coverage < HEALTHY_COVERAGE) return null;
  return makeNotification({
    id: "caixa_saudavel",
    category: "caixa",
    severity: "success",
    title: "Caixa confortável",
    message: `O caixa atual (${formatCurrency(cash.currentBalance)}) cobre ${coverage} dias de despesas.`,
    recommendation: "Bom momento para reforçar a reserva antes de novas retiradas.",
    action: "acompanhar",
    createdAt: ctx.createdAt,
  });
};

export const contaVencendoRule: ProactiveRule = (ctx) => {
  const cash = ctx.summary.cash.data;
  if (!cash || cash.payable <= 0) return null;
  return makeNotification({
    id: "conta_vencendo",
    category: "financeiro",
    severity: cash.payable > cash.currentBalance ? "warning" : "info",
    title: "Contas a pagar em aberto",
    message: `Há ${formatCurrency(cash.payable)} a pagar no período, com saldo atual de ${formatCurrency(cash.currentBalance)}.`,
    recommendation:
      cash.payable > cash.currentBalance
        ? "Negocie prazos: os compromissos superam o saldo disponível hoje."
        : "Programe os pagamentos para preservar o fluxo de caixa.",
    action: "negociar_prazos",
    createdAt: ctx.createdAt,
  });
};

export const contaVencidaRule: ProactiveRule = (ctx) => {
  const cash = ctx.summary.cash.data;
  if (!cash || cash.receivableOverdue <= 0) return null;
  return makeNotification({
    id: "conta_vencida",
    category: "financeiro",
    severity: "warning",
    title: "Valores vencidos a receber",
    message: `${formatCurrency(cash.receivableOverdue)} já venceram e continuam em aberto.`,
    recommendation: "Acione os clientes inadimplentes antes de assumir novos compromissos.",
    action: "cobrar_cliente",
    createdAt: ctx.createdAt,
  });
};

export const estoqueBaixoRule: ProactiveRule = (ctx) => {
  const inv = ctx.summary.inventory.data;
  if (!inv || inv.belowMinCount <= 0) return null;
  return makeNotification({
    id: "estoque_baixo",
    category: "estoque",
    severity: inv.belowMinCount >= 10 ? "critical" : "warning",
    title: "Estoque abaixo do mínimo",
    message: `${inv.belowMinCount} produto(s) estão abaixo do estoque mínimo definido.`,
    recommendation: "Programe a reposição dos itens de maior giro para não perder vendas.",
    action: "comprar_estoque",
    createdAt: ctx.createdAt,
  });
};

export const produtoParadoRule: ProactiveRule = (ctx) => {
  const inv = ctx.summary.inventory.data;
  if (!inv || inv.stagnantCount <= 0) return null;
  return makeNotification({
    id: "produto_parado",
    category: "produtos",
    severity: inv.stagnantCount >= 5 ? "warning" : "info",
    title: "Produtos sem giro",
    message: `${inv.stagnantCount} produto(s) estão parados no estoque (${formatCurrency(inv.inventoryValue)} em estoque total).`,
    recommendation: "Reveja o mix: promoções ou descontinuação liberam capital parado.",
    action: "revisar_mix",
    createdAt: ctx.createdAt,
  });
};

export const clienteDestaqueRule: ProactiveRule = (ctx) => {
  const top = ctx.summary.customers.data?.topCustomers?.[0];
  if (!top || top.revenue <= 0) return null;
  return makeNotification({
    id: "cliente_destaque",
    category: "clientes",
    severity: "success",
    title: "Cliente destaque do período",
    message: `${top.name} comprou ${formatCurrency(top.revenue)} em ${top.purchases} pedido(s).`,
    recommendation: "Reconheça o cliente: condições especiais ajudam a manter a recorrência.",
    action: "manter_ritmo",
    createdAt: ctx.createdAt,
  });
};

export const clienteInativoRule: ProactiveRule = (ctx) => {
  const c = ctx.summary.customers.data;
  if (!c) return null;
  const inactive = c.total - c.active;
  if (inactive <= 0) return null;
  return makeNotification({
    id: "cliente_inativo",
    category: "clientes",
    severity: "info",
    title: "Clientes sem compras no período",
    message: `${inactive} de ${c.total} clientes cadastrados não compraram no período.`,
    recommendation: "Faça uma ação de reativação com a base inativa.",
    action: "reativar_cliente",
    createdAt: ctx.createdAt,
  });
};

export const margemBaixaRule: ProactiveRule = (ctx) => {
  const margin = ctx.summary.margin.data;
  if (!margin) return null;
  if (margin.netMargin >= HEALTHY_MARGIN) return null;
  const negative = margin.netMargin < 0;
  return makeNotification({
    id: "margem_baixa",
    category: "lucro",
    severity: negative ? "critical" : "warning",
    title: negative ? "Margem líquida negativa" : "Margem líquida baixa",
    message: `A margem líquida do período está em ${pct(margin.netMargin)}${negative ? " (negativa)" : ""}.`,
    recommendation: "Reveja preços e custos dos produtos com maior participação nas vendas.",
    action: "revisar_preco",
    magnitude: margin.netMargin,
    createdAt: ctx.createdAt,
  });
};

export const muitasDespesasRule: ProactiveRule = (ctx) => {
  const expenses = ctx.summary.expenses.data;
  if (!expenses || expenses.expenseRatio <= HIGH_EXPENSE_RATIO) return null;
  return makeNotification({
    id: "muitas_despesas",
    category: "financeiro",
    severity: "warning",
    title: "Despesas acima do recomendado",
    message: `As despesas representam ${pct(expenses.expenseRatio)} da receita (${formatCurrency(expenses.totalExpenses)}).`,
    recommendation: "Liste as maiores despesas do período e corte o que não gera venda.",
    action: "reduzir_despesas",
    magnitude: expenses.expenseRatio,
    createdAt: ctx.createdAt,
  });
};

export const impostoProximoRule: ProactiveRule = (ctx) => {
  const taxes = ctx.summary.taxes.data;
  if (!taxes || taxes.taxAmount <= 0) return null;
  const days = taxes.dueDate ? daysUntil(taxes.dueDate, ctx.createdAt) : null;
  const near = days != null && days >= 0 && days <= TAX_WINDOW_DAYS;
  const late = days != null && days < 0;
  if (!near && !late) {
    return makeNotification({
      id: "imposto_previsto",
      category: "fiscal",
      severity: "info",
      title: "Imposto previsto no período",
      message: `Competência ${taxes.competence}: ${formatCurrency(taxes.taxAmount)} previstos.`,
      recommendation: "Reserve o valor do imposto antes de qualquer retirada.",
      action: "programar_imposto",
      createdAt: ctx.createdAt,
    });
  }
  return makeNotification({
    id: "imposto_proximo",
    category: "fiscal",
    severity: late ? "critical" : "warning",
    title: late ? "Imposto vencido" : "Imposto vencendo",
    message: late
      ? `O imposto de ${taxes.competence} (${formatCurrency(taxes.taxAmount)}) venceu há ${Math.abs(days!)} dia(s).`
      : `O imposto de ${taxes.competence} (${formatCurrency(taxes.taxAmount)}) vence em ${days} dia(s).`,
    recommendation: "Garanta o valor em caixa e programe o pagamento com o contador.",
    action: "programar_imposto",
    createdAt: ctx.createdAt,
  });
};

export const prolaboreAcimaRule: ProactiveRule = (ctx) => {
  const advice = ctx.advice;
  if (!advice || !advice.available || !advice.payroll.available) return null;
  const suggested = advice.payroll.suggestedAmount;
  if (suggested <= 0) return null;
  if (advice.withdrawal.safeAmount >= suggested) return null;
  return makeNotification({
    id: "prolabore_acima",
    category: "financeiro",
    severity: "warning",
    title: "Pró-labore acima do que o caixa suporta",
    message: `O pró-labore sugerido é ${formatCurrency(suggested)}, mas a retirada segura hoje é ${formatCurrency(advice.withdrawal.safeAmount)}.`,
    recommendation: "Ajuste a retirada deste mês ao teto seguro apurado pelo Advisor.",
    action: "ajustar_prolabore",
    createdAt: ctx.createdAt,
  });
};

export const retiradaRiscoRule: ProactiveRule = (ctx) => {
  const advice = ctx.advice;
  if (!advice || !advice.available) return null;
  const risky = advice.risk.level === "high" || advice.risk.level === "critical";
  const noRoom = advice.withdrawal.safeAmount <= 0;
  if (!risky && !noRoom) return null;
  return makeNotification({
    id: "retirada_risco",
    category: "caixa",
    severity: advice.risk.level === "critical" ? "critical" : "warning",
    title: noRoom ? "Sem margem para retirada" : "Retirada em zona de risco",
    message: noRoom
      ? `Após compromissos e reserva, não há valor disponível para retirada (risco ${advice.risk.label}).`
      : `O risco financeiro está ${advice.risk.label} (${advice.risk.score}/100) e a retirada segura é ${formatCurrency(advice.withdrawal.safeAmount)}.`,
    recommendation: "Adie ou reduza a retirada até o caixa cobrir os compromissos do período.",
    action: "revisar_retirada",
    createdAt: ctx.createdAt,
  });
};

export const dadosIncompletosRule: ProactiveRule = (ctx) => {
  const missing = unavailableProviders({ summary: ctx.summary });
  if (missing.length === 0) return null;
  return makeNotification({
    id: "dados_incompletos",
    category: "sistema",
    severity: "info",
    title: "Leitura parcial dos dados",
    message: `Sem dados de ${missing.join(", ")} no período — a Bella não estima valores.`,
    recommendation: "Registre as informações faltantes para uma análise completa.",
    action: "conferir_dados",
    createdAt: ctx.createdAt,
  });
};

/** Todas as regras, na ordem de declaração. */
export const PROACTIVE_RULES: ProactiveRule[] = [
  receitaCrescendoRule,
  receitaCaindoRule,
  lucroCaindoRule,
  caixaCriticoRule,
  caixaSaudavelRule,
  contaVencendoRule,
  contaVencidaRule,
  estoqueBaixoRule,
  produtoParadoRule,
  clienteDestaqueRule,
  clienteInativoRule,
  margemBaixaRule,
  muitasDespesasRule,
  impostoProximoRule,
  prolaboreAcimaRule,
  retiradaRiscoRule,
  dadosIncompletosRule,
];

/** Executa uma regra isolada com proteção — usado pelo engine. */
export function runRule(
  rule: ProactiveRule,
  ctx: ProactiveContext,
): BellaNotification | null {
  try {
    return rule(ctx);
  } catch {
    return null;
  }
}
