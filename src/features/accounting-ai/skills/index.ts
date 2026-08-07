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
import { buildBellaNotifications } from "../proactive";
import { taxRegimeProvider, taxSimulationProvider } from "../tax/provider";
import {
  describeAnnex,
  describeBracket,
  describeDas,
  describeDueDate,
  describeRate,
  describeRbt12,
  describeSimulation,
} from "../tax/selectors";
import { auditProvider } from "../audit/provider";
import { explanationProvider } from "../explanation/provider";
import {
  describeImpactRanking,
  describeIndicators,
  describeTopic,
} from "../explanation/selectors";
import { NO_EVIDENCE, type ExplanationTopic } from "../explanation/types";
import {
  describeAudit,
  describeFindings,
  describeOperationalHealth,
} from "../audit/selectors";
import { payrollSkills } from "../payroll/skills/payroll-skills";

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
  | "consultar_risco"
  | "consultar_notificacoes"
  | "consultar_das"
  | "consultar_rbt12"
  | "consultar_anexo"
  | "consultar_aliquota"
  | "consultar_faixa"
  | "consultar_vencimento_das"
  | "simular_tributos"
  | "auditar_empresa"
  | "consultar_inconsistencias"
  | "consultar_saude_operacional"
  | "explicar_lucro"
  | "explicar_caixa"
  | "explicar_receita"
  | "explicar_despesas"
  | "explicar_impostos"
  | "explicar_ticket"
  | "explicar_estoque"
  | "explicar_resultado"
  | "explicar_indicadores"
  | "consultar_prolabore_recomendado"
  | "simular_retirada";

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
    const res = deps?.summary?.profit ?? (await profitProvider(companyId, deps));
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
    const res = deps?.summary?.cashFlow ?? (await cashFlowProvider(companyId, deps));
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
    const res = deps?.summary?.cash ?? (await cashProvider(companyId, deps));
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
    const res = deps?.summary?.taxes ?? (await taxesProvider(companyId, deps));
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
    const res = deps?.summary?.payroll ?? (await payrollProvider(companyId, deps));
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
    const res = deps?.summary?.payroll ?? (await payrollProvider(companyId, deps));
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
    const res = deps?.summary?.products ?? (await productsProvider(companyId, deps));
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
    const [today, month] = deps?.summary
      ? [deps.summary.today, deps.summary.revenue]
      : await Promise.all([
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
    const res = deps?.summary?.ticket ?? (await ticketProvider(companyId, deps));
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
    const res = deps?.summary?.customers ?? (await customersProvider(companyId, deps));
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
    const res = deps?.summary?.health ?? (await healthProvider(companyId, deps));
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

/**
 * Leitura consolidada usada pelas skills (somente leitura).
 * Sprint 6.1.6 — P1: quando o chamador já agregou o resumo (`deps.summary`),
 * nenhuma skill reconstrói o `AccountingSummary`.
 */
async function readSummary(companyId: string, deps?: ProviderDeps) {
  return deps?.summary ?? buildAccountingSummary(companyId, deps);
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

export const consultarNotificacoesSkill: AccountingSkill = {
  id: "consultar_notificacoes",
  name: "Consultar notificações",
  description: "Notificações proativas da Bella — apenas recomendações.",
  readOnly: true,
  async run(companyId, deps) {
    const summary = await readSummary(companyId, deps);
    const notifications = buildBellaNotifications({ summary });
    if (notifications.length === 0) {
      return { ok: true, text: "Nada exigindo atenção agora.", data: [] };
    }
    return {
      ok: true,
      text: notifications
        .slice(0, 5)
        .map((n) => `${n.title}: ${n.message}`)
        .join(" "),
      data: notifications,
    };
  },
};

/* ───────────── Sprint 7.1 — skills tributárias (motor oficial) ───────────── */

/** Lê o retrato tributário uma única vez por pergunta. */
async function readTaxSnapshot(companyId: string, deps?: ProviderDeps) {
  return deps?.taxSnapshot ?? (await taxRegimeProvider(companyId, deps));
}

export const consultarDasSkill: AccountingSkill = {
  id: "consultar_das",
  name: "Consultar DAS",
  description: "DAS apurado ou previsto pelo motor oficial do Simples.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await readTaxSnapshot(companyId, deps);
    if (!res.data) return empty("DAS");
    return { ok: true, text: describeDas(res.data), data: res.data };
  },
};

export const consultarRbt12Skill: AccountingSkill = {
  id: "consultar_rbt12",
  name: "Consultar RBT12",
  description: "Receita bruta dos últimos 12 meses e uso do teto do Simples.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await readTaxSnapshot(companyId, deps);
    if (!res.data) return empty("RBT12");
    return { ok: true, text: describeRbt12(res.data), data: res.data };
  },
};

export const consultarAnexoSkill: AccountingSkill = {
  id: "consultar_anexo",
  name: "Consultar anexo e regime",
  description: "Regime tributário e anexo do Simples do perfil oficial.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await readTaxSnapshot(companyId, deps);
    if (!res.data) return empty("regime tributário");
    return { ok: true, text: describeAnnex(res.data), data: res.data };
  },
};

export const consultarAliquotaSkill: AccountingSkill = {
  id: "consultar_aliquota",
  name: "Consultar alíquota efetiva",
  description: "Alíquota efetiva, nominal e dedução da faixa atual.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await readTaxSnapshot(companyId, deps);
    if (!res.data) return empty("alíquota");
    return { ok: true, text: describeRate(res.data), data: res.data };
  },
};

export const consultarFaixaSkill: AccountingSkill = {
  id: "consultar_faixa",
  name: "Consultar faixa do Simples",
  description: "Faixa atual, teto da faixa e distância para a próxima.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await readTaxSnapshot(companyId, deps);
    if (!res.data) return empty("faixa do Simples");
    return { ok: true, text: describeBracket(res.data), data: res.data };
  },
};

export const consultarVencimentoDasSkill: AccountingSkill = {
  id: "consultar_vencimento_das",
  name: "Consultar vencimento do DAS",
  description: "Data de vencimento do DAS da competência.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await readTaxSnapshot(companyId, deps);
    if (!res.data) return empty("vencimento do DAS");
    return { ok: true, text: describeDueDate(res.data), data: res.data };
  },
};

export const simularTributosSkill: AccountingSkill = {
  id: "simular_tributos",
  name: "Simular tributos",
  description: "Cenários de faturamento e DAS via motor oficial de projeções.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await taxSimulationProvider(companyId, deps?.simulation ?? {}, deps);
    if (!res.data) return empty("simulação tributária");
    return { ok: true, text: describeSimulation(res.data), data: res.data };
  },
};

/* ───────────── Sprint 7.2 — skills de auditoria (somente leitura) ───────────── */

/** Lê o retrato de auditoria uma única vez por pergunta. */
async function readAuditSnapshot(companyId: string, deps?: ProviderDeps) {
  return deps?.auditSnapshot ?? (await auditProvider(companyId, deps));
}

export const auditarEmpresaSkill: AccountingSkill = {
  id: "auditar_empresa",
  name: "Auditar empresa",
  description: "Auditoria completa de inconsistências (nunca corrige dados).",
  readOnly: true,
  async run(companyId, deps) {
    const res = await readAuditSnapshot(companyId, deps);
    if (!res.data) return empty("auditoria");
    return { ok: true, text: describeAudit(res.data), data: res.data };
  },
};

export const consultarInconsistenciasSkill: AccountingSkill = {
  id: "consultar_inconsistencias",
  name: "Consultar inconsistências",
  description: "Lista as inconsistências encontradas pela auditoria.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await readAuditSnapshot(companyId, deps);
    if (!res.data) return empty("inconsistências");
    return { ok: true, text: describeFindings(res.data), data: res.data.findings };
  },
};

export const consultarSaudeOperacionalSkill: AccountingSkill = {
  id: "consultar_saude_operacional",
  name: "Consultar saúde operacional",
  description: "Score de saúde operacional derivado da auditoria.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await readAuditSnapshot(companyId, deps);
    if (!res.data) return empty("saúde operacional");
    return {
      ok: true,
      text: describeOperationalHealth(res.data),
      data: res.data.health,
    };
  },
};

/* ───────────────── Sprint 7.3 — Bella Explica (somente leitura) ───────────────── */

async function readExplanation(companyId: string, deps?: ProviderDeps) {
  return deps?.explanation ?? (await explanationProvider(companyId, deps));
}

/** Fábrica das skills de explicação — todas leem o MESMO retrato oficial. */
function makeExplanationSkill(
  id: AccountingSkillId,
  name: string,
  description: string,
  topic: ExplanationTopic,
): AccountingSkill {
  return {
    id,
    name,
    description,
    readOnly: true,
    async run(companyId, deps) {
      const res = await readExplanation(companyId, deps);
      const explanation = res.data?.explanations[topic] ?? null;
      if (!explanation || !explanation.available) {
        return { ok: false, text: NO_EVIDENCE, data: null };
      }
      return {
        ok: true,
        text: describeTopic(res.data, topic),
        data: explanation,
      };
    },
  };
}

export const explicarLucroSkill = makeExplanationSkill(
  "explicar_lucro",
  "Explicar lucro",
  "Explica a variação do lucro com base na DRE oficial.",
  "lucro",
);

export const explicarCaixaSkill = makeExplanationSkill(
  "explicar_caixa",
  "Explicar caixa",
  "Explica a posição de caixa com base no financeiro oficial.",
  "caixa",
);

export const explicarReceitaSkill = makeExplanationSkill(
  "explicar_receita",
  "Explicar receita",
  "Explica a variação da receita com base na DRE e nas vendas oficiais.",
  "receita",
);

export const explicarDespesasSkill = makeExplanationSkill(
  "explicar_despesas",
  "Explicar despesas",
  "Explica a variação das despesas com base na DRE oficial.",
  "despesas",
);

export const explicarImpostosSkill = makeExplanationSkill(
  "explicar_impostos",
  "Explicar impostos",
  "Explica o DAS com base no motor tributário oficial.",
  "impostos",
);

export const explicarTicketSkill = makeExplanationSkill(
  "explicar_ticket",
  "Explicar ticket médio",
  "Explica a variação do ticket médio com base nas métricas de vendas.",
  "ticket",
);

export const explicarEstoqueSkill = makeExplanationSkill(
  "explicar_estoque",
  "Explicar estoque",
  "Explica a situação do estoque com base no motor de estoque oficial.",
  "estoque",
);

export const explicarResultadoSkill: AccountingSkill = {
  id: "explicar_resultado",
  name: "Explicar resultado",
  description: "Rankeia os maiores impactos do período (dados oficiais).",
  readOnly: true,
  async run(companyId, deps) {
    const res = await readExplanation(companyId, deps);
    if (!res.data || res.data.ranking.length === 0) {
      return { ok: false, text: NO_EVIDENCE, data: null };
    }
    return {
      ok: true,
      text: describeImpactRanking(res.data),
      data: res.data.ranking,
    };
  },
};

export const explicarIndicadoresSkill: AccountingSkill = {
  id: "explicar_indicadores",
  name: "Explicar indicadores",
  description: "Panorama explicado dos principais indicadores do período.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await readExplanation(companyId, deps);
    const text = describeIndicators(res.data);
    if (!res.data || text === NO_EVIDENCE) {
      return { ok: false, text: NO_EVIDENCE, data: null };
    }
    return { ok: true, text, data: res.data.explanations };
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
  consultarNotificacoesSkill,
  consultarDasSkill,
  consultarRbt12Skill,
  consultarAnexoSkill,
  consultarAliquotaSkill,
  consultarFaixaSkill,
  consultarVencimentoDasSkill,
  simularTributosSkill,
  auditarEmpresaSkill,
  consultarInconsistenciasSkill,
  consultarSaudeOperacionalSkill,
  explicarLucroSkill,
  explicarCaixaSkill,
  explicarReceitaSkill,
  explicarDespesasSkill,
  explicarImpostosSkill,
  explicarTicketSkill,
  explicarEstoqueSkill,
  explicarResultadoSkill,
  explicarIndicadoresSkill,
  ...payrollSkills,
];


export function getAccountingSkill(id: AccountingSkillId): AccountingSkill | undefined {
  return accountingAiSkills.find((s) => s.id === id);
}
