/**
 * Bella Contadora — skills (somente estrutura, sem IA nesta sprint).
 *
 * Cada skill é um descritor tipado com um `run` que apenas consulta
 * providers existentes e devolve dados brutos + texto determinístico.
 */
import { formatCurrency } from "@/lib/format";
import type { ProviderDeps } from "../providers";
import {
  cashFlowProvider,
  cashProvider,
  customersProvider,
  healthProvider,
  payrollProvider,
  productsProvider,
  profitProvider,
  revenueProvider,
  taxesProvider,
  ticketProvider,
  todayProvider,
} from "../providers";
import { healthLabel } from "../lib/health";
import { buildAccountingSummary } from "../providers/summary";
import {
  buildAccountingAlerts,
  buildAccountingInsights,
  buildAccountingRecommendations,
} from "../insights";
import { accountingAdapter } from "../services/adapters";
import { currentPeriod } from "../lib/helpers";
import { advisorQueries, buildFinancialAdvice } from "../advisor";

export type AccountingSkillId =
  | "consultar_lucro"
  | "consultar_fluxo"
  | "consultar_dre"
  | "consultar_caixa"
  | "consultar_impostos"
  | "consultar_prolabore"
  | "consultar_reserva"
  | "consultar_produtos"
  | "consultar_receita"
  | "consultar_ticket"
  | "consultar_clientes"
  | "consultar_saude"
  | "consultar_insights"
  | "consultar_alertas"
  | "consultar_recomendacoes"
  | "consultar_retirada"
  | "consultar_disponibilidade"
  | "consultar_risco";

export interface AccountingSkillResult {
  ok: boolean;
  text: string;
  data: unknown;
}

export interface AccountingSkill {
  id: AccountingSkillId;
  name: string;
  description: string;
  readOnly: true;
  run(companyId: string, deps?: ProviderDeps): Promise<AccountingSkillResult>;
}

const empty = (what: string): AccountingSkillResult => ({
  ok: false,
  text: `Sem dados de ${what} para o período.`,
  data: null,
});

export const consultarLucroSkill: AccountingSkill = {
  id: "consultar_lucro",
  name: "Consultar lucro",
  description: "Lucro bruto, operacional e líquido do período.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await profitProvider(companyId, deps);
    if (!res.data) return empty("lucro");
    return {
      ok: true,
      text: `Lucro líquido ${formatCurrency(res.data.netProfit)} (margem ${res.data.netMargin.toFixed(2)}%).`,
      data: res.data,
    };
  },
};

export const consultarFluxoSkill: AccountingSkill = {
  id: "consultar_fluxo",
  name: "Consultar fluxo de caixa",
  description: "Entradas e saídas previstas para os próximos 30 dias.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await cashFlowProvider(companyId, deps);
    if (!res.data) return empty("fluxo de caixa");
    return {
      ok: true,
      text: `Previsão 30 dias: entradas ${formatCurrency(res.data.incoming)} · saídas ${formatCurrency(res.data.outgoing)} · líquido ${formatCurrency(res.data.net)}.`,
      data: res.data,
    };
  },
};

export const consultarDreSkill: AccountingSkill = {
  id: "consultar_dre",
  name: "Consultar DRE",
  description: "DRE do período, direto do motor contábil.",
  readOnly: true,
  async run(companyId, deps) {
    const period = deps?.period ?? currentPeriod();
    const service = deps?.services?.accounting ?? accountingAdapter;
    try {
      const dre = await service.dre(companyId, period);
      return {
        ok: true,
        text: `Receita líquida ${formatCurrency(dre.netRevenue)} · lucro líquido ${formatCurrency(dre.netProfit)}.`,
        data: dre,
      };
    } catch {
      return empty("DRE");
    }
  },
};

export const consultarCaixaSkill: AccountingSkill = {
  id: "consultar_caixa",
  name: "Consultar caixa",
  description: "Saldo atual, a receber e a pagar.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await cashProvider(companyId, deps);
    if (!res.data) return empty("caixa");
    return {
      ok: true,
      text: `Saldo ${formatCurrency(res.data.currentBalance)} · a receber ${formatCurrency(res.data.receivable)} · a pagar ${formatCurrency(res.data.payable)}.`,
      data: res.data,
    };
  },
};

export const consultarImpostosSkill: AccountingSkill = {
  id: "consultar_impostos",
  name: "Consultar impostos",
  description: "Apuração fiscal da competência (motor fiscal existente).",
  readOnly: true,
  async run(companyId, deps) {
    const res = await taxesProvider(companyId, deps);
    if (!res.data) return empty("impostos");
    return {
      ok: true,
      text: `Competência ${res.data.competence}: imposto ${formatCurrency(res.data.taxAmount)} sobre receita ${formatCurrency(res.data.revenue)}.`,
      data: res.data,
    };
  },
};

export const consultarProlaboreSkill: AccountingSkill = {
  id: "consultar_prolabore",
  name: "Consultar pró-labore sugerido",
  description: "Sugestão indicativa de retirada sobre o lucro apurado.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await payrollProvider(companyId, deps);
    if (!res.data) return empty("pró-labore");
    return {
      ok: true,
      text: `Pró-labore sugerido ${formatCurrency(res.data.suggestedAmount)} (${res.data.suggestedRate.toFixed(0)}% do lucro).`,
      data: res.data,
    };
  },
};

export const consultarReservaSkill: AccountingSkill = {
  id: "consultar_reserva",
  name: "Consultar reserva financeira",
  description: "Reserva sugerida sobre o lucro apurado.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await payrollProvider(companyId, deps);
    if (!res.data) return empty("reserva financeira");
    return {
      ok: true,
      text: `Reserva sugerida ${formatCurrency(res.data.reserveAmount)} (${res.data.reserveRate.toFixed(0)}% do lucro).`,
      data: { reserveAmount: res.data.reserveAmount, reserveRate: res.data.reserveRate },
    };
  },
};

export const consultarProdutosSkill: AccountingSkill = {
  id: "consultar_produtos",
  name: "Consultar produtos",
  description: "Campeões de venda, sem giro e abaixo do mínimo.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await productsProvider(companyId, deps);
    if (!res.data) return empty("produtos");
    const top = res.data.bestSellers[0];
    return {
      ok: true,
      text: top
        ? `Produto campeão: ${top.name} (${formatCurrency(top.revenue)}). Sem giro: ${res.data.stagnant.length}.`
        : `Sem vendas no período. Sem giro: ${res.data.stagnant.length}.`,
      data: res.data,
    };
  },
};

export const consultarReceitaSkill: AccountingSkill = {
  id: "consultar_receita",
  name: "Consultar receita",
  description: "Receita de hoje e receita líquida do período.",
  readOnly: true,
  async run(companyId, deps) {
    const [today, month] = await Promise.all([
      todayProvider(companyId, deps),
      revenueProvider(companyId, deps),
    ]);
    if (!today.data && !month.data) return empty("receita");
    const parts: string[] = [];
    if (today.data) {
      parts.push(
        `Hoje: ${formatCurrency(today.data.total)} em ${today.data.count} venda(s).`,
      );
    }
    if (month.data) {
      parts.push(`No período: receita líquida ${formatCurrency(month.data.netRevenue)}.`);
    }
    return { ok: true, text: parts.join(" "), data: { today: today.data, month: month.data } };
  },
};

export const consultarTicketSkill: AccountingSkill = {
  id: "consultar_ticket",
  name: "Consultar ticket médio",
  description: "Ticket médio e quantidade de vendas do período.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await ticketProvider(companyId, deps);
    if (!res.data) return empty("ticket médio");
    return {
      ok: true,
      text: `Ticket médio ${formatCurrency(res.data.averageTicket)} em ${res.data.salesCount} venda(s) (total ${formatCurrency(res.data.monthTotal)}).`,
      data: res.data,
    };
  },
};

export const consultarClientesSkill: AccountingSkill = {
  id: "consultar_clientes",
  name: "Consultar clientes",
  description: "Clientes ativos, recorrentes e maiores compradores.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await customersProvider(companyId, deps);
    if (!res.data) return empty("clientes");
    const byRevenue = [...res.data.topCustomers].sort((a, b) => b.revenue - a.revenue)[0];
    const byPurchases = [...res.data.topCustomers].sort((a, b) => b.purchases - a.purchases)[0];
    const parts = [
      `${res.data.active} cliente(s) ativos de ${res.data.total} cadastrados.`,
    ];
    if (byRevenue) parts.push(`Maior faturamento: ${byRevenue.name} (${formatCurrency(byRevenue.revenue)}).`);
    if (byPurchases) parts.push(`Mais compras: ${byPurchases.name} (${byPurchases.purchases}).`);
    return { ok: true, text: parts.join(" "), data: res.data };
  },
};

export const consultarSaudeSkill: AccountingSkill = {
  id: "consultar_saude",
  name: "Consultar saúde financeira",
  description: "Score de saúde apurado pelos helpers da Bella.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await healthProvider(companyId, deps);
    if (!res.data) return empty("saúde financeira");
    const warnings = res.data.warnings.length
      ? ` Pontos de atenção: ${res.data.warnings.join(" ")}`
      : "";
    return {
      ok: true,
      text: `Saúde financeira ${healthLabel(res.data)} (${res.data.score}/100).${warnings}`,
      data: res.data,
    };
  },
};

/** Leitura consolidada usada pelas skills de insights (somente leitura). */
async function readSummary(companyId: string, deps?: ProviderDeps) {
  return buildAccountingSummary(companyId, deps);
}

export const consultarInsightsSkill: AccountingSkill = {
  id: "consultar_insights",
  name: "Consultar insights",
  description: "Interpretação dos números do período (Insight Engine puro).",
  readOnly: true,
  async run(companyId, deps) {
    const summary = await readSummary(companyId, deps);
    const insights = buildAccountingInsights(summary);
    if (insights.length === 0) return empty("insights");
    return {
      ok: true,
      text: insights.map((i) => `${i.title}: ${i.description}`).join(" "),
      data: insights,
    };
  },
};

export const consultarAlertasSkill: AccountingSkill = {
  id: "consultar_alertas",
  name: "Consultar alertas",
  description: "Somente insights críticos e de atenção.",
  readOnly: true,
  async run(companyId, deps) {
    const summary = await readSummary(companyId, deps);
    const alerts = buildAccountingAlerts(summary);
    if (alerts.length === 0) {
      return { ok: true, text: "Nenhum alerta no período.", data: [] };
    }
    return {
      ok: true,
      text: alerts.map((i) => `${i.title}: ${i.description}`).join(" "),
      data: alerts,
    };
  },
};

export const consultarRecomendacoesSkill: AccountingSkill = {
  id: "consultar_recomendacoes",
  name: "Consultar recomendações",
  description: "Ações sugeridas a partir dos insights — nenhuma é executada.",
  readOnly: true,
  async run(companyId, deps) {
    const summary = await readSummary(companyId, deps);
    const recs = buildAccountingRecommendations(summary);
    if (recs.length === 0) return empty("recomendações");
    return {
      ok: true,
      text: recs.map((r) => `${r.action.label}: ${r.recommendation}`).join(" "),
      data: recs,
    };
  },
};

/** Consultoria financeira (Sprint 5.3) — advisor puro sobre o resumo lido. */
async function readAdvice(companyId: string, deps?: ProviderDeps) {
  const summary = await readSummary(companyId, deps);
  return { summary, advice: buildFinancialAdvice({ summary }) };
}

export const consultarRetiradaSkill: AccountingSkill = {
  id: "consultar_retirada",
  name: "Consultar retirada segura",
  description: "Quanto pode ser retirado do caixa hoje sem comprometer a operação.",
  readOnly: true,
  async run(companyId, deps) {
    const { advice } = await readAdvice(companyId, deps);
    if (!advice.available) return empty("retirada segura");
    const answer = advisorQueries.quantoPossoRetirar(advice);
    return { ok: true, text: answer.text, data: advice.withdrawal };
  },
};

export const consultarDisponibilidadeSkill: AccountingSkill = {
  id: "consultar_disponibilidade",
  name: "Consultar disponibilidade",
  description: "Caixa disponível hoje versus compromissos assumidos.",
  readOnly: true,
  async run(companyId, deps) {
    const { advice } = await readAdvice(companyId, deps);
    if (!advice.available) return empty("disponibilidade");
    const disponivel = advisorQueries.quantoDisponivel(advice);
    const comprometido = advisorQueries.quantoComprometido(advice);
    return {
      ok: true,
      text: `${disponivel.text} ${comprometido.text}`,
      data: { availableCash: advice.availableCash, commitments: advice.commitments },
    };
  },
};

export const consultarRiscoSkill: AccountingSkill = {
  id: "consultar_risco",
  name: "Consultar risco de caixa",
  description: "Nível de risco financeiro apurado para retiradas.",
  readOnly: true,
  async run(companyId, deps) {
    const { advice } = await readAdvice(companyId, deps);
    if (!advice.available) return empty("risco de caixa");
    return {
      ok: true,
      text: `Risco ${advice.risk.label} (${advice.risk.score}/100). ${advice.risk.reasons.join(" ")}`,
      data: advice.risk,
    };
  },
};

export const accountingAiSkills: AccountingSkill[] = [
  consultarLucroSkill,
  consultarFluxoSkill,
  consultarDreSkill,
  consultarCaixaSkill,
  consultarImpostosSkill,
  consultarProlaboreSkill,
  consultarReservaSkill,
  consultarProdutosSkill,
  consultarReceitaSkill,
  consultarTicketSkill,
  consultarClientesSkill,
  consultarSaudeSkill,
  consultarInsightsSkill,
  consultarAlertasSkill,
  consultarRecomendacoesSkill,
  consultarRetiradaSkill,
  consultarDisponibilidadeSkill,
  consultarRiscoSkill,
];


export function getAccountingSkill(id: AccountingSkillId): AccountingSkill | undefined {
  return accountingAiSkills.find((s) => s.id === id);
}
