/**
 * Bella Contadora — ExplanationBuilder (Sprint 7.3).
 *
 * 100% puro. Recebe um `ExplanationDataset` (números já apurados pelos
 * motores oficiais) e devolve explicações no formato
 * Resumo → causas → dados → recomendação.
 *
 * Regras invioláveis:
 *  - nenhum indicador é recalculado aqui;
 *  - nenhuma estimativa, projeção ou heurística financeira nova;
 *  - sem evidência ⇒ `available: false` + `NO_EVIDENCE`.
 */
import { formatCurrency } from "@/lib/format";
import { computeTrend } from "../lib/trend";
import type { TrendComparison } from "../types";
import {
  EXPLANATION_TOPICS,
  EXPLANATION_TOPIC_LABELS,
  NO_EVIDENCE,
  type Explanation,
  type ExplanationCause,
  type ExplanationDataset,
  type ExplanationDirection,
  type ExplanationEvidence,
  type ExplanationSnapshot,
  type ExplanationTopic,
  type ExplanationUnit,
} from "./types";

/** Variação monetária ignorada (ruído de centavos). */
const MIN_MONEY = 0.01;
/** Variação percentual/contagem ignorada. */
const MIN_UNIT = 0.05;

function pct(value: number): string {
  return `${Math.abs(value).toFixed(1).replace(".", ",")}%`;
}

function signedPct(value: number): string {
  return `${value >= 0 ? "+" : "-"}${pct(value)}`;
}

function fmt(value: number, unit: ExplanationUnit): string {
  if (unit === "currency") return formatCurrency(value);
  if (unit === "percent") return `${value.toFixed(1).replace(".", ",")}%`;
  return String(Math.round(value));
}

function direction(delta: number, unit: ExplanationUnit): ExplanationDirection {
  const min = unit === "currency" ? MIN_MONEY : MIN_UNIT;
  if (Math.abs(delta) < min) return "flat";
  return delta > 0 ? "up" : "down";
}

interface CauseInput {
  id: string;
  topic: ExplanationTopic;
  label: string;
  current: number;
  previous: number | null;
  unit: ExplanationUnit;
  /** true quando o aumento PIORA o indicador explicado (custos, despesas). */
  inverse?: boolean;
  source: string;
}

/** Cria uma causa comparando dois números oficiais. Nunca inventa valores. */
function makeCause(input: CauseInput): ExplanationCause | null {
  if (input.previous == null || !Number.isFinite(input.previous)) return null;
  if (!Number.isFinite(input.current)) return null;
  const delta = input.current - input.previous;
  const dir = direction(delta, input.unit);
  if (dir === "flat") return null;

  const worsens = input.inverse ? delta > 0 : delta < 0;
  const variation =
    input.previous === 0 ? null : (delta / Math.abs(input.previous)) * 100;

  const detail =
    `${input.label}: ${fmt(input.previous, input.unit)} → ${fmt(input.current, input.unit)} ` +
    `(${delta >= 0 ? "+" : "-"}${fmt(Math.abs(delta), input.unit)}` +
    `${variation == null ? "" : `, ${signedPct(variation)}`}) · ${input.source}`;

  return {
    id: input.id,
    topic: input.topic,
    label: input.label,
    impact: delta,
    weight: Math.abs(delta),
    unit: input.unit,
    direction: dir,
    effect: worsens ? "negativo" : "positivo",
    detail,
    current: input.current,
    previous: input.previous,
  };
}

/** Causa medida por valor absoluto (sem período anterior disponível). */
function makeAbsoluteCause(input: {
  id: string;
  topic: ExplanationTopic;
  label: string;
  value: number;
  unit: ExplanationUnit;
  effect: ExplanationCause["effect"];
  source: string;
}): ExplanationCause | null {
  if (!Number.isFinite(input.value) || Math.abs(input.value) < MIN_MONEY) return null;
  return {
    id: input.id,
    topic: input.topic,
    label: input.label,
    impact: input.value,
    weight: Math.abs(input.value),
    unit: input.unit,
    direction: input.value > 0 ? "up" : "down",
    effect: input.effect,
    detail: `${input.label}: ${fmt(input.value, input.unit)} · ${input.source}`,
    current: input.value,
    previous: null,
  };
}

function rank(causes: Array<ExplanationCause | null>, limit = 3): ExplanationCause[] {
  return causes
    .filter((c): c is ExplanationCause => c !== null)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}

function insufficient(topic: ExplanationTopic, note?: string): Explanation {
  return {
    topic,
    available: false,
    headline: NO_EVIDENCE,
    summary: NO_EVIDENCE,
    causes: [],
    biggestImpact: null,
    evidence: [],
    recommendation: null,
    trend: null,
    note,
  };
}

/** Recomendação determinística, escolhida pela causa de maior impacto. */
const RECOMMENDATIONS: Record<string, string> = {
  receita: "Revisar divulgação, mix e conversão de vendas do período.",
  deducoes: "Conferir descontos e devoluções lançados no período.",
  cmv: "Revisar fornecedores e custo de compra dos produtos mais vendidos.",
  despesas_operacionais: "Revisar as despesas operacionais lançadas no período.",
  despesas_financeiras: "Renegociar juros, tarifas e prazos com o banco.",
  outras_despesas: "Conferir a classificação das outras despesas do período.",
  ticket: "Revisar precificação e composição do carrinho.",
  vendas: "Aumentar o volume de atendimentos e retomar clientes recorrentes.",
  clientes_ativos: "Reativar clientes que compraram no período anterior.",
  clientes_novos: "Reforçar a captação de novos clientes.",
  clientes_recorrentes: "Trabalhar a recompra da base já existente.",
  saldo: "Acompanhar o caixa diariamente até recompor a folga.",
  recebiveis_vencidos: "Priorizar a cobrança dos títulos vencidos.",
  a_pagar: "Renegociar prazos das contas a pagar mais próximas.",
  saidas_previstas: "Escalonar os pagamentos previstos para os próximos 30 dias.",
  entradas_previstas: "Antecipar recebíveis apenas se o custo for menor que a folga.",
  rbt12: "Acompanhar o RBT12 — ele define a faixa e a alíquota do Simples.",
  faixa: "Planejar o faturamento considerando a mudança de faixa do Simples.",
  aliquota: "Revisar o mix de receita: a alíquota efetiva mudou.",
  receita_tributavel: "Programar o caixa para o DAS maior deste mês.",
  valor_estoque: "Revisar compras: há capital parado em estoque.",
  estoque_baixo: "Repor os produtos abaixo do estoque mínimo.",
  estoque_parado: "Criar ação comercial para os produtos sem giro.",
  margem_bruta: "Revisar preço de venda e custo dos produtos.",
  base_prolabore: "Ajustar a retirada ao resultado apurado do período.",
  reserva: "Recompor a reserva antes de aumentar a retirada.",
  cmv_ratio: "Revisar custo por produto — o CMV cresceu sobre a receita.",
  despesa_ratio: "Reduzir despesas fixas — elas cresceram sobre a receita.",
};

function recommend(causes: ExplanationCause[], fallback: string): string {
  const worst = causes.find((c) => c.effect === "negativo") ?? causes[0];
  if (!worst) return fallback;
  return RECOMMENDATIONS[worst.id] ?? fallback;
}

function trendSentence(label: string, trend: TrendComparison): string {
  if (!trend.hasHistory || trend.deltaPercent == null) {
    return `${label}: ${formatCurrency(trend.current)} (sem período anterior para comparar).`;
  }
  if (trend.direction === "flat") {
    return `${label} estável em ${formatCurrency(trend.current)} frente ao período anterior.`;
  }
  const verb = trend.direction === "up" ? "subiu" : "caiu";
  return `${label} ${verb} ${pct(trend.deltaPercent)} — de ${formatCurrency(trend.previous ?? 0)} para ${formatCurrency(trend.current)}.`;
}

function build(
  topic: ExplanationTopic,
  args: {
    headline: string;
    summary: string;
    causes: ExplanationCause[];
    evidence: ExplanationEvidence[];
    trend: TrendComparison | null;
    fallbackRecommendation: string;
  },
): Explanation {
  if (args.causes.length === 0) return insufficient(topic);
  return {
    topic,
    available: true,
    headline: args.headline,
    summary: args.summary,
    causes: args.causes,
    biggestImpact: args.causes[0] ?? null,
    evidence: args.evidence,
    recommendation: recommend(args.causes, args.fallbackRecommendation),
    trend: args.trend,
  };
}

/* ─────────────────────────── explicações por tema ─────────────────────────── */

function explainLucro(d: ExplanationDataset): Explanation {
  const cur = d.current;
  const prev = d.previous;
  if (!cur || !prev) return insufficient("lucro");
  const trend = computeTrend(cur.netProfit, prev.netProfit);
  const causes = rank([
    makeCause({ id: "receita", topic: "lucro", label: "Receita líquida", current: cur.netRevenue, previous: prev.netRevenue, unit: "currency", source: "DRE oficial" }),
    makeCause({ id: "cmv", topic: "lucro", label: "CMV", current: cur.cogs, previous: prev.cogs, unit: "currency", inverse: true, source: "DRE oficial" }),
    makeCause({ id: "despesas_operacionais", topic: "lucro", label: "Despesas operacionais", current: cur.operatingExpenses, previous: prev.operatingExpenses, unit: "currency", inverse: true, source: "DRE oficial" }),
    makeCause({ id: "despesas_financeiras", topic: "lucro", label: "Despesas financeiras", current: cur.financialExpenses, previous: prev.financialExpenses, unit: "currency", inverse: true, source: "DRE oficial" }),
    makeCause({ id: "outras_despesas", topic: "lucro", label: "Outras despesas", current: cur.otherExpenses, previous: prev.otherExpenses, unit: "currency", inverse: true, source: "DRE oficial" }),
    makeCause({ id: "deducoes", topic: "lucro", label: "Deduções sobre a receita", current: cur.deductions, previous: prev.deductions, unit: "currency", inverse: true, source: "DRE oficial" }),
  ]);
  return build("lucro", {
    headline: trendSentence("Lucro líquido", trend),
    summary: trendSentence("Lucro líquido", trend),
    causes,
    evidence: [
      { label: "Lucro líquido", value: formatCurrency(cur.netProfit), source: "DRE oficial" },
      { label: "Receita líquida", value: formatCurrency(cur.netRevenue), source: "DRE oficial" },
      { label: "CMV", value: formatCurrency(cur.cogs), source: "DRE oficial" },
      { label: "Despesas totais", value: formatCurrency(cur.operatingExpenses + cur.financialExpenses + cur.otherExpenses), source: "DRE oficial" },
      { label: "Margem líquida", value: `${cur.netMargin.toFixed(1).replace(".", ",")}%`, source: "KPIs oficiais" },
    ],
    trend,
    fallbackRecommendation: "Revisar receita, custo e despesas do período.",
  });
}

function explainReceita(d: ExplanationDataset): Explanation {
  const cur = d.current;
  const prev = d.previous;
  if (!cur || !prev) return insufficient("receita");
  const trend = computeTrend(cur.netRevenue, prev.netRevenue);
  const causes = rank([
    makeCause({ id: "ticket", topic: "receita", label: "Ticket médio", current: cur.averageTicket, previous: prev.averageTicket, unit: "currency", source: "Métricas de vendas" }),
    makeCause({ id: "vendas", topic: "receita", label: "Vendas realizadas", current: cur.salesCount, previous: prev.salesCount, unit: "count", source: "Métricas de vendas" }),
    makeCause({ id: "clientes_ativos", topic: "receita", label: "Clientes ativos", current: cur.customersActive, previous: prev.customersActive, unit: "count", source: "Relatório de clientes" }),
    makeCause({ id: "deducoes", topic: "receita", label: "Deduções sobre a receita", current: cur.deductions, previous: prev.deductions, unit: "currency", inverse: true, source: "DRE oficial" }),
  ]);
  return build("receita", {
    headline: trendSentence("Receita líquida", trend),
    summary: trendSentence("Receita líquida", trend),
    causes,
    evidence: [
      { label: "Receita bruta", value: formatCurrency(cur.grossRevenue), source: "DRE oficial" },
      { label: "Receita líquida", value: formatCurrency(cur.netRevenue), source: "DRE oficial" },
      { label: "Vendas", value: String(cur.salesCount), source: "Métricas de vendas" },
      { label: "Ticket médio", value: formatCurrency(cur.averageTicket), source: "Métricas de vendas" },
    ],
    trend,
    fallbackRecommendation: "Revisar volume de vendas e ticket médio do período.",
  });
}

function explainMargem(d: ExplanationDataset): Explanation {
  const cur = d.current;
  const prev = d.previous;
  if (!cur || !prev) return insufficient("margem");
  const trend = computeTrend(cur.netMargin, prev.netMargin);
  const causes = rank([
    makeCause({ id: "cmv_ratio", topic: "margem", label: "CMV sobre a receita", current: cur.cogsRatio, previous: prev.cogsRatio, unit: "percent", inverse: true, source: "KPIs oficiais" }),
    makeCause({ id: "despesa_ratio", topic: "margem", label: "Despesas sobre a receita", current: cur.expenseRatio, previous: prev.expenseRatio, unit: "percent", inverse: true, source: "KPIs oficiais" }),
    makeCause({ id: "margem_bruta", topic: "margem", label: "Margem bruta", current: cur.grossMargin, previous: prev.grossMargin, unit: "percent", source: "DRE oficial" }),
  ]);
  return build("margem", {
    headline: `Margem líquida em ${cur.netMargin.toFixed(1).replace(".", ",")}% (antes ${prev.netMargin.toFixed(1).replace(".", ",")}%).`,
    summary: `Margem líquida em ${cur.netMargin.toFixed(1).replace(".", ",")}% contra ${prev.netMargin.toFixed(1).replace(".", ",")}% no período anterior.`,
    causes,
    evidence: [
      { label: "Margem líquida", value: `${cur.netMargin.toFixed(1).replace(".", ",")}%`, source: "KPIs oficiais" },
      { label: "Margem bruta", value: `${cur.grossMargin.toFixed(1).replace(".", ",")}%`, source: "DRE oficial" },
      { label: "CMV/Receita", value: `${cur.cogsRatio.toFixed(1).replace(".", ",")}%`, source: "KPIs oficiais" },
    ],
    trend,
    fallbackRecommendation: "Revisar preço de venda, custo e despesas fixas.",
  });
}

function explainCmv(d: ExplanationDataset): Explanation {
  const cur = d.current;
  const prev = d.previous;
  if (!cur || !prev) return insufficient("cmv");
  const trend = computeTrend(cur.cogs, prev.cogs);
  const causes = rank([
    makeCause({ id: "cmv", topic: "cmv", label: "CMV", current: cur.cogs, previous: prev.cogs, unit: "currency", inverse: true, source: "DRE oficial" }),
    makeCause({ id: "cmv_ratio", topic: "cmv", label: "CMV sobre a receita", current: cur.cogsRatio, previous: prev.cogsRatio, unit: "percent", inverse: true, source: "KPIs oficiais" }),
    makeCause({ id: "receita", topic: "cmv", label: "Receita líquida", current: cur.netRevenue, previous: prev.netRevenue, unit: "currency", source: "DRE oficial" }),
  ]);
  return build("cmv", {
    headline: trendSentence("CMV", trend),
    summary: trendSentence("CMV", trend),
    causes,
    evidence: [
      { label: "CMV", value: formatCurrency(cur.cogs), source: "DRE oficial" },
      { label: "CMV/Receita", value: `${cur.cogsRatio.toFixed(1).replace(".", ",")}%`, source: "KPIs oficiais" },
      { label: "Margem bruta", value: `${cur.grossMargin.toFixed(1).replace(".", ",")}%`, source: "DRE oficial" },
    ],
    trend,
    fallbackRecommendation: "Revisar custo de compra dos produtos mais vendidos.",
  });
}

function explainDespesas(d: ExplanationDataset): Explanation {
  const cur = d.current;
  const prev = d.previous;
  if (!cur || !prev) return insufficient("despesas");
  const total = cur.operatingExpenses + cur.financialExpenses + cur.otherExpenses;
  const prevTotal = prev.operatingExpenses + prev.financialExpenses + prev.otherExpenses;
  const trend = computeTrend(total, prevTotal);
  const causes = rank([
    makeCause({ id: "despesas_operacionais", topic: "despesas", label: "Despesas operacionais", current: cur.operatingExpenses, previous: prev.operatingExpenses, unit: "currency", inverse: true, source: "DRE oficial" }),
    makeCause({ id: "despesas_financeiras", topic: "despesas", label: "Despesas financeiras", current: cur.financialExpenses, previous: prev.financialExpenses, unit: "currency", inverse: true, source: "DRE oficial" }),
    makeCause({ id: "outras_despesas", topic: "despesas", label: "Outras despesas", current: cur.otherExpenses, previous: prev.otherExpenses, unit: "currency", inverse: true, source: "DRE oficial" }),
    makeCause({ id: "cmv", topic: "despesas", label: "CMV", current: cur.cogs, previous: prev.cogs, unit: "currency", inverse: true, source: "DRE oficial" }),
  ]);
  return build("despesas", {
    headline: trendSentence("Despesas totais", trend),
    summary: trendSentence("Despesas totais", trend),
    causes,
    evidence: [
      { label: "Despesas operacionais", value: formatCurrency(cur.operatingExpenses), source: "DRE oficial" },
      { label: "Despesas financeiras", value: formatCurrency(cur.financialExpenses), source: "DRE oficial" },
      { label: "Outras despesas", value: formatCurrency(cur.otherExpenses), source: "DRE oficial" },
      { label: "Despesas/Receita", value: `${cur.expenseRatio.toFixed(1).replace(".", ",")}%`, source: "KPIs oficiais" },
    ],
    trend,
    fallbackRecommendation: "Revisar as maiores despesas lançadas no período.",
  });
}

function explainTicket(d: ExplanationDataset): Explanation {
  const cur = d.current;
  const prev = d.previous;
  if (!cur || !prev) return insufficient("ticket");
  const trend = computeTrend(cur.averageTicket, prev.averageTicket);
  const causes = rank([
    makeCause({ id: "ticket", topic: "ticket", label: "Ticket médio", current: cur.averageTicket, previous: prev.averageTicket, unit: "currency", source: "Métricas de vendas" }),
    makeCause({ id: "vendas", topic: "ticket", label: "Vendas realizadas", current: cur.salesCount, previous: prev.salesCount, unit: "count", source: "Métricas de vendas" }),
    makeCause({ id: "receita", topic: "ticket", label: "Receita líquida", current: cur.netRevenue, previous: prev.netRevenue, unit: "currency", source: "DRE oficial" }),
  ]);
  return build("ticket", {
    headline: trendSentence("Ticket médio", trend),
    summary: trendSentence("Ticket médio", trend),
    causes,
    evidence: [
      { label: "Ticket médio", value: formatCurrency(cur.averageTicket), source: "Métricas de vendas" },
      { label: "Vendas", value: String(cur.salesCount), source: "Métricas de vendas" },
      { label: "Receita líquida", value: formatCurrency(cur.netRevenue), source: "DRE oficial" },
    ],
    trend,
    fallbackRecommendation: "Revisar precificação e composição do carrinho.",
  });
}

function explainClientes(d: ExplanationDataset): Explanation {
  const cur = d.current;
  const prev = d.previous;
  if (!cur || !prev) return insufficient("clientes");
  const trend = computeTrend(cur.customersActive, prev.customersActive);
  const causes = rank([
    makeCause({ id: "clientes_ativos", topic: "clientes", label: "Clientes ativos", current: cur.customersActive, previous: prev.customersActive, unit: "count", source: "Relatório de clientes" }),
    makeCause({ id: "clientes_novos", topic: "clientes", label: "Clientes novos", current: cur.customersNew, previous: prev.customersNew, unit: "count", source: "Relatório de clientes" }),
    makeCause({ id: "clientes_recorrentes", topic: "clientes", label: "Clientes recorrentes", current: cur.customersRecurring, previous: prev.customersRecurring, unit: "count", source: "Relatório de clientes" }),
    makeCause({ id: "ticket", topic: "clientes", label: "Ticket médio", current: cur.averageTicket, previous: prev.averageTicket, unit: "currency", source: "Métricas de vendas" }),
  ]);
  return build("clientes", {
    headline: `Clientes ativos: ${cur.customersActive} (antes ${prev.customersActive}).`,
    summary: `Clientes ativos: ${cur.customersActive} contra ${prev.customersActive} no período anterior.`,
    causes,
    evidence: [
      { label: "Clientes ativos", value: String(cur.customersActive), source: "Relatório de clientes" },
      { label: "Clientes novos", value: String(cur.customersNew), source: "Relatório de clientes" },
      { label: "Clientes recorrentes", value: String(cur.customersRecurring), source: "Relatório de clientes" },
    ],
    trend,
    fallbackRecommendation: "Retomar contato com a base que comprou no período anterior.",
  });
}

function explainCaixa(d: ExplanationDataset): Explanation {
  const cash = d.summary?.cash.data ?? null;
  const flow = d.summary?.cashFlow.data ?? null;
  if (!cash) return insufficient("caixa");
  const causes = rank([
    makeAbsoluteCause({ id: "recebiveis_vencidos", topic: "caixa", label: "Recebíveis vencidos", value: cash.receivableOverdue, unit: "currency", effect: "negativo", source: "Financeiro oficial" }),
    makeAbsoluteCause({ id: "a_pagar", topic: "caixa", label: "Contas a pagar em aberto", value: cash.payable, unit: "currency", effect: "negativo", source: "Financeiro oficial" }),
    makeAbsoluteCause({ id: "saidas_previstas", topic: "caixa", label: "Saídas previstas (30 dias)", value: flow?.outgoing ?? 0, unit: "currency", effect: "negativo", source: "Projeção oficial de fluxo" }),
    makeAbsoluteCause({ id: "entradas_previstas", topic: "caixa", label: "Entradas previstas (30 dias)", value: flow?.incoming ?? 0, unit: "currency", effect: "positivo", source: "Projeção oficial de fluxo" }),
    makeAbsoluteCause({ id: "saldo", topic: "caixa", label: "Saldo atual", value: cash.currentBalance, unit: "currency", effect: cash.currentBalance < 0 ? "negativo" : "positivo", source: "Financeiro oficial" }),
  ]);
  return build("caixa", {
    headline: `Saldo atual de ${formatCurrency(cash.currentBalance)}, com ${formatCurrency(cash.receivable)} a receber e ${formatCurrency(cash.payable)} a pagar.`,
    summary: `Saldo atual de ${formatCurrency(cash.currentBalance)}; projeção do período em ${formatCurrency(cash.projected)}.`,
    causes,
    evidence: [
      { label: "Saldo atual", value: formatCurrency(cash.currentBalance), source: "Financeiro oficial" },
      { label: "A receber", value: formatCurrency(cash.receivable), source: "Financeiro oficial" },
      { label: "Vencido a receber", value: formatCurrency(cash.receivableOverdue), source: "Financeiro oficial" },
      { label: "A pagar", value: formatCurrency(cash.payable), source: "Financeiro oficial" },
      { label: "Saldo projetado", value: formatCurrency(cash.projected), source: "Projeção oficial de fluxo" },
    ],
    trend: null,
    fallbackRecommendation: "Priorizar a cobrança e escalonar os pagamentos previstos.",
  });
}

function explainFluxo(d: ExplanationDataset): Explanation {
  const flow = d.summary?.cashFlow.data ?? null;
  if (!flow) return insufficient("fluxo_caixa");
  const causes = rank([
    makeAbsoluteCause({ id: "entradas_previstas", topic: "fluxo_caixa", label: "Entradas previstas", value: flow.incoming, unit: "currency", effect: "positivo", source: "Projeção oficial de fluxo" }),
    makeAbsoluteCause({ id: "saidas_previstas", topic: "fluxo_caixa", label: "Saídas previstas", value: flow.outgoing, unit: "currency", effect: "negativo", source: "Projeção oficial de fluxo" }),
    makeAbsoluteCause({ id: "saldo", topic: "fluxo_caixa", label: "Resultado líquido previsto", value: flow.net, unit: "currency", effect: flow.net < 0 ? "negativo" : "positivo", source: "Projeção oficial de fluxo" }),
  ]);
  return build("fluxo_caixa", {
    headline: `Previsão de ${flow.horizonDays} dias: entradas ${formatCurrency(flow.incoming)} e saídas ${formatCurrency(flow.outgoing)}.`,
    summary: `Fluxo líquido previsto de ${formatCurrency(flow.net)} em ${flow.horizonDays} dias.`,
    causes,
    evidence: [
      { label: "Entradas previstas", value: formatCurrency(flow.incoming), source: "Projeção oficial de fluxo" },
      { label: "Saídas previstas", value: formatCurrency(flow.outgoing), source: "Projeção oficial de fluxo" },
      { label: "Saldo projetado", value: formatCurrency(flow.projectedBalance), source: "Projeção oficial de fluxo" },
    ],
    trend: null,
    fallbackRecommendation: "Acompanhar entradas e saídas previstas para os próximos 30 dias.",
  });
}

function explainEstoque(d: ExplanationDataset): Explanation {
  const inv = d.summary?.inventory.data ?? null;
  if (!inv) return insufficient("estoque");
  const causes = rank([
    makeAbsoluteCause({ id: "valor_estoque", topic: "estoque", label: "Capital em estoque", value: inv.inventoryValue, unit: "currency", effect: "neutro", source: "Estoque oficial" }),
    makeAbsoluteCause({ id: "estoque_baixo", topic: "estoque", label: "Produtos abaixo do mínimo", value: inv.belowMinCount, unit: "count", effect: "negativo", source: "Estoque oficial" }),
    makeAbsoluteCause({ id: "estoque_parado", topic: "estoque", label: "Produtos sem giro", value: inv.stagnantCount, unit: "count", effect: "negativo", source: "Estoque oficial" }),
  ]);
  return build("estoque", {
    headline: `${inv.productCount} produto(s) e ${formatCurrency(inv.inventoryValue)} em estoque.`,
    summary: `${inv.belowMinCount} produto(s) abaixo do mínimo e ${inv.stagnantCount} sem giro.`,
    causes,
    evidence: [
      { label: "Capital em estoque", value: formatCurrency(inv.inventoryValue), source: "Estoque oficial" },
      { label: "Abaixo do mínimo", value: String(inv.belowMinCount), source: "Estoque oficial" },
      { label: "Sem giro", value: String(inv.stagnantCount), source: "Estoque oficial" },
    ],
    trend: null,
    fallbackRecommendation: "Repor o que está abaixo do mínimo e girar o que está parado.",
  });
}

function explainImpostos(d: ExplanationDataset): Explanation {
  const tax = d.tax;
  if (!tax) return insufficient("impostos");
  const history = tax.history ?? [];
  const previousPoint = history.find((h) => h.competence !== tax.competence) ?? null;
  const causes = rank([
    makeCause({ id: "receita_tributavel", topic: "impostos", label: "Receita da competência", current: tax.monthRevenue, previous: previousPoint?.revenue ?? null, unit: "currency", source: "Motor tributário oficial" }),
    makeCause({ id: "aliquota", topic: "impostos", label: "Alíquota efetiva", current: tax.effectiveRate, previous: previousPoint?.effectiveRate ?? null, unit: "percent", inverse: true, source: "Motor tributário oficial" }),
    makeCause({ id: "faixa", topic: "impostos", label: "Faixa do Simples", current: tax.bracket ?? 0, previous: previousPoint?.bracket ?? null, unit: "count", inverse: true, source: "Motor tributário oficial" }),
    makeAbsoluteCause({ id: "rbt12", topic: "impostos", label: "RBT12", value: tax.rbt12, unit: "currency", effect: "neutro", source: "RPC oficial company_rbt12" }),
  ]);
  return build("impostos", {
    headline: `DAS de ${formatCurrency(tax.dasAmount)} na competência ${tax.competence} (alíquota efetiva ${tax.effectiveRate.toFixed(2).replace(".", ",")}%).`,
    summary: `RBT12 de ${formatCurrency(tax.rbt12)} posiciona a empresa na faixa ${tax.bracket ?? "—"} do Simples.`,
    causes,
    evidence: [
      { label: "DAS", value: formatCurrency(tax.dasAmount), source: "Motor tributário oficial" },
      { label: "RBT12", value: formatCurrency(tax.rbt12), source: "RPC oficial company_rbt12" },
      { label: "Faixa", value: String(tax.bracket ?? "—"), source: "Motor tributário oficial" },
      { label: "Alíquota efetiva", value: `${tax.effectiveRate.toFixed(2).replace(".", ",")}%`, source: "Motor tributário oficial" },
      { label: "Receita da competência", value: formatCurrency(tax.monthRevenue), source: "Motor tributário oficial" },
    ],
    trend: null,
    fallbackRecommendation: "Acompanhar RBT12 e faixa antes de projetar o próximo DAS.",
  });
}

function explainProlabore(d: ExplanationDataset): Explanation {
  const payroll = d.summary?.payroll.data ?? null;
  if (!payroll) return insufficient("prolabore");
  const causes = rank([
    makeAbsoluteCause({ id: "base_prolabore", topic: "prolabore", label: "Base de cálculo apurada", value: payroll.basis, unit: "currency", effect: "neutro", source: "Advisor oficial da Bella" }),
    makeAbsoluteCause({ id: "reserva", topic: "prolabore", label: "Reserva recomendada", value: payroll.reserveAmount, unit: "currency", effect: "negativo", source: "Advisor oficial da Bella" }),
    makeAbsoluteCause({ id: "saldo", topic: "prolabore", label: "Lucro distribuível", value: payroll.distributableProfit, unit: "currency", effect: payroll.distributableProfit < 0 ? "negativo" : "positivo", source: "Advisor oficial da Bella" }),
  ]);
  return build("prolabore", {
    headline: `Pró-labore sugerido de ${formatCurrency(payroll.suggestedAmount)}.`,
    summary: payroll.rationale,
    causes,
    evidence: [
      { label: "Base", value: formatCurrency(payroll.basis), source: "Advisor oficial da Bella" },
      { label: "Sugestão", value: formatCurrency(payroll.suggestedAmount), source: "Advisor oficial da Bella" },
      { label: "Reserva", value: formatCurrency(payroll.reserveAmount), source: "Advisor oficial da Bella" },
      { label: "Lucro distribuível", value: formatCurrency(payroll.distributableProfit), source: "Advisor oficial da Bella" },
    ],
    trend: null,
    fallbackRecommendation: "Manter a retirada dentro do lucro distribuível apurado.",
  });
}

const BUILDERS: Record<ExplanationTopic, (d: ExplanationDataset) => Explanation> = {
  lucro: explainLucro,
  receita: explainReceita,
  margem: explainMargem,
  cmv: explainCmv,
  caixa: explainCaixa,
  fluxo_caixa: explainFluxo,
  despesas: explainDespesas,
  ticket: explainTicket,
  clientes: explainClientes,
  estoque: explainEstoque,
  impostos: explainImpostos,
  prolabore: explainProlabore,
};

/** Explicação de um único tema. */
export function buildExplanation(
  topic: ExplanationTopic,
  dataset: ExplanationDataset,
): Explanation {
  return BUILDERS[topic](dataset);
}

/**
 * Ranking dos impactos monetários do período (maior → menor).
 * Só considera causas comparadas contra o período anterior.
 */
export function buildImpactRanking(
  dataset: ExplanationDataset,
  limit = 3,
): ExplanationCause[] {
  const monetary = ["lucro", "despesas", "receita"] as const;
  const seen = new Set<string>();
  const causes: ExplanationCause[] = [];
  for (const topic of monetary) {
    const explanation = BUILDERS[topic](dataset);
    if (!explanation.available) continue;
    for (const cause of explanation.causes) {
      if (cause.unit !== "currency" || cause.previous == null) continue;
      if (seen.has(cause.id)) continue;
      seen.add(cause.id);
      causes.push(cause);
    }
  }
  return causes.sort((a, b) => b.weight - a.weight).slice(0, limit);
}

/** Monta o retrato completo com todos os temas + ranking. */
export function buildExplanationSnapshot(
  dataset: ExplanationDataset,
  generatedAt = new Date().toISOString(),
): ExplanationSnapshot {
  const explanations = {} as Record<ExplanationTopic, Explanation>;
  for (const topic of EXPLANATION_TOPICS) {
    explanations[topic] = BUILDERS[topic](dataset);
  }
  return {
    generatedAt,
    period: dataset.period,
    previousPeriod: dataset.previousPeriod,
    dataset,
    explanations,
    ranking: buildImpactRanking(dataset),
  };
}

export { EXPLANATION_TOPIC_LABELS };
