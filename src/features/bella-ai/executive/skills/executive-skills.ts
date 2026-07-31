/**
 * Bella CEO — Skills executivas.
 *
 * Todas as respostas vêm do `executiveService` (RPC
 * `generate_executive_summary`), que reaproveita os motores contábil,
 * financeiro, tributário e de estoque. Nenhum cálculo é duplicado e
 * nenhuma skill escreve dados.
 */

import { executiveService } from "../services/executive.service";
import type { ExecutiveReport } from "../types";
import type { BellaSkill, BellaSkillContext } from "../../skills/types";
import { skillResult } from "../../skills/types";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

const canRead = (ctx: BellaSkillContext) => Boolean(ctx.companyId);

async function load(ctx: BellaSkillContext): Promise<ExecutiveReport | null> {
  try {
    return await executiveService.report(ctx.companyId);
  } catch {
    return null;
  }
}

const unavailable = skillResult.unavailable(
  "Ainda não consigo montar o panorama executivo. Verifique se há movimento financeiro no período.",
);

function skill(
  id: string,
  name: string,
  description: string,
  render: (r: ExecutiveReport) => string[],
): BellaSkill {
  return {
    id,
    name,
    module: "executive",
    description,
    canExecute: canRead,
    async execute(_payload, ctx) {
      const report = await load(ctx);
      if (!report) return unavailable;
      return skillResult.success(render(report).join("\n"), report);
    },
  };
}

export const companyStatusSkill = skill(
  "executive.status",
  "Como está minha empresa?",
  "Panorama executivo completo: resultado, caixa, risco e prioridades.",
  (r) => {
    const { dre, cash } = r.snapshot;
    return [
      `Receita do período: ${BRL.format(dre.grossRevenue)}`,
      `Lucro líquido: ${BRL.format(dre.netProfit)} (margem ${pct(dre.netMargin)})`,
      `EBITDA: ${BRL.format(dre.ebitda)}`,
      `Caixa disponível: ${BRL.format(cash.available)}`,
      `A receber: ${BRL.format(cash.receivable)} | A pagar: ${BRL.format(cash.payable)}`,
      `Score executivo: ${r.risk.overallScore}/100 (${r.risk.severity})`,
    ];
  },
);

export const growthSkill = skill(
  "executive.growth",
  "Estou crescendo?",
  "Compara receita, lucro e margem com o período anterior.",
  (r) => {
    const { dre, previousDre } = r.snapshot;
    const growth = previousDre.grossRevenue > 0
      ? ((dre.grossRevenue - previousDre.grossRevenue) / previousDre.grossRevenue) * 100
      : 0;
    return [
      growth >= 0 ? `Sim: receita ${pct(growth)} acima do período anterior.` : `Atenção: receita ${pct(Math.abs(growth))} abaixo do período anterior.`,
      `Receita: ${BRL.format(dre.grossRevenue)} vs ${BRL.format(previousDre.grossRevenue)}`,
      `Lucro: ${BRL.format(dre.netProfit)} vs ${BRL.format(previousDre.netProfit)}`,
      `Margem líquida: ${pct(dre.netMargin)} vs ${pct(previousDre.netMargin)}`,
    ];
  },
);

export const canHireSkill = skill(
  "executive.can_hire",
  "Posso contratar?",
  "Avalia se o resultado e a cobertura de caixa suportam custo fixo adicional.",
  (r) => {
    const cashKpi = r.kpis.find((k) => k.key === "cash_coverage_days")?.value ?? 0;
    const ok = r.snapshot.dre.netProfit > 0 && (cashKpi ?? 0) >= 60 && r.risk.overallScore >= 70;
    const capacity = Math.max(r.snapshot.dre.netProfit * 0.3, 0);
    return [
      ok ? "Sim, com cautela." : "Ainda não recomendo contratar.",
      `Lucro do período: ${BRL.format(r.snapshot.dre.netProfit)}`,
      `Cobertura de caixa: ${Math.round(cashKpi ?? 0)} dias`,
      `Folga mensal sugerida para novo custo fixo: ${BRL.format(capacity)}`,
    ];
  },
);

export const canInvestSkill = skill(
  "executive.can_invest",
  "Posso investir?",
  "Verifica caixa livre após obrigações e reserva tributária.",
  (r) => {
    const { cash, tax } = r.snapshot;
    const free = cash.available - cash.payable - tax.estimatedTax;
    return [
      free > 0 ? `Sim, há ${BRL.format(free)} livres após obrigações e impostos.` : `Não. Faltam ${BRL.format(Math.abs(free))} para cobrir obrigações e impostos.`,
      `Caixa: ${BRL.format(cash.available)} | A pagar: ${BRL.format(cash.payable)} | Impostos: ${BRL.format(tax.estimatedTax)}`,
    ];
  },
);

export const canWithdrawSkill = skill(
  "executive.can_withdraw",
  "Posso retirar dinheiro?",
  "Calcula retirada segura preservando capital de giro e tributos.",
  (r) => {
    const { cash, tax } = r.snapshot;
    const safe = Math.max(cash.available - cash.payable - tax.estimatedTax, 0) * 0.5;
    return [
      safe > 0 ? `Retirada segura estimada: ${BRL.format(safe)}.` : "No momento não há folga para retirada.",
      "O cálculo preserva contas a pagar, reserva de impostos e metade da folga como capital de giro.",
    ];
  },
);

export const whereLosingMoneySkill = skill(
  "executive.where_losing",
  "Onde estou perdendo dinheiro?",
  "Aponta produtos no prejuízo, despesas em alta e estoque parado.",
  (r) => {
    const rank = executiveService.rankings(r);
    const lines = [
      `Despesas operacionais: ${BRL.format(r.snapshot.dre.operatingExpenses)}`,
      `CMV: ${BRL.format(r.snapshot.dre.cogs)}`,
      `Estoque parado: ${r.snapshot.inventory.staleItems} produto(s)`,
    ];
    if (rank.products.negative.length) {
      lines.push(
        `Produtos no prejuízo: ${rank.products.negative.slice(0, 5).map((p) => `${p.name} (${BRL.format(p.profit)})`).join(", ")}`,
      );
    }
    if (r.snapshot.cash.overdueReceivable > 0) {
      lines.push(`Recebíveis vencidos: ${BRL.format(r.snapshot.cash.overdueReceivable)}`);
    }
    return lines;
  },
);

export const biggestRiskSkill = skill(
  "executive.risk",
  "Qual meu maior risco?",
  "Ranking das cinco dimensões de risco com score de 0 a 100.",
  (r) => {
    const sorted = [...r.risk.risks].sort((a, b) => a.score - b.score);
    const worst = sorted[0];
    return [
      `Maior risco: ${worst.label} (${worst.score}/100).`,
      ...worst.reasons.map((x) => `• ${x}`),
      "",
      ...sorted.map((x) => `${x.label}: ${x.score}/100`),
    ];
  },
);

export const todayPrioritySkill = skill(
  "executive.priority",
  "Qual minha prioridade hoje?",
  "Ação mais urgente segundo insights e risco.",
  (r) => {
    const urgent = r.recommendations.find((x) => x.priority === "urgent") ?? r.recommendations[0];
    if (!urgent) return ["Nenhuma ação urgente identificada hoje. Bom trabalho."];
    return [`Prioridade: ${urgent.title}`, urgent.description];
  },
);

export const weekPlanSkill = skill(
  "executive.week_plan",
  "O que devo fazer esta semana?",
  "Plano executivo com as recomendações priorizadas.",
  (r) => {
    if (!r.recommendations.length) return ["Semana tranquila: nenhuma ação crítica pendente."];
    return [
      "Plano da semana:",
      ...r.recommendations.slice(0, 6).map((x, i) => `${i + 1}. ${x.title} — ${x.description}`),
    ];
  },
);

export const stopSellingSkill = skill(
  "executive.stop_selling",
  "Qual produto devo parar de vender?",
  "Produtos com margem negativa ou sem giro.",
  (r) => {
    const rank = executiveService.rankings(r);
    if (!rank.products.negative.length && !rank.products.staleStock.length) {
      return ["Nenhum produto com margem negativa ou estoque parado relevante."];
    }
    return [
      ...(rank.products.negative.length
        ? [`Margem negativa: ${rank.products.negative.slice(0, 5).map((p) => p.name).join(", ")}`]
        : []),
      ...(rank.products.staleStock.length
        ? [`Sem giro há 90 dias: ${rank.products.staleStock.slice(0, 5).map((p) => p.name).join(", ")}`]
        : []),
    ];
  },
);

export const customerAttentionSkill = skill(
  "executive.customer_attention",
  "Qual cliente merece atenção?",
  "Clientes mais lucrativos, recorrentes e inadimplentes.",
  (r) => {
    const rank = executiveService.rankings(r);
    const lines: string[] = [];
    if (rank.customers.topRevenue[0]) {
      const c = rank.customers.topRevenue[0];
      lines.push(`Maior faturamento: ${c.name} (${BRL.format(c.revenue)} em ${c.salesCount} venda(s)).`);
    }
    if (rank.customers.topRecurring[0]) {
      lines.push(`Mais recorrente: ${rank.customers.topRecurring[0].name}.`);
    }
    if (rank.customers.topOverdue[0]) {
      const c = rank.customers.topOverdue[0];
      lines.push(`Maior inadimplência: ${c.name} (${BRL.format(c.overdueAmount)} vencidos).`);
    }
    return lines.length ? lines : ["Ainda não há histórico suficiente de clientes no período."];
  },
);

export const forecastSkill = skill(
  "executive.forecast",
  "Qual a projeção dos próximos dias?",
  "Projeção de receita, caixa, lucro e impostos em 7, 15, 30 e 90 dias.",
  (r) =>
    r.forecast.map(
      (f) =>
        `${f.horizonDays} dias — Receita ${BRL.format(f.revenue)} | Caixa ${BRL.format(f.cash)} | Lucro ${BRL.format(f.profit)} | Impostos ${BRL.format(f.taxes)}`,
    ),
);

export const executiveSkills: BellaSkill[] = [
  companyStatusSkill,
  growthSkill,
  canHireSkill,
  canInvestSkill,
  canWithdrawSkill,
  whereLosingMoneySkill,
  biggestRiskSkill,
  todayPrioritySkill,
  weekPlanSkill,
  stopSellingSkill,
  customerAttentionSkill,
  forecastSkill,
];
