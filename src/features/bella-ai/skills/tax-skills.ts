/**
 * Bella Contadora — Skills tributárias.
 *
 * Todas as respostas vêm do motor tributário real (`taxQuery` →
 * `taxService` → RPCs sobre vendas, perfil e apurações). Apenas a skill
 * de apuração escreve dados (gera a competência e o lançamento contábil).
 */

import { taxQuery } from "../providers/modules/tax.provider";
import { taxService, toCompetence, taxBurden } from "@/features/tax";
import type { BellaSkill, BellaSkillContext, BellaSkillPayload } from "./types";
import { skillResult } from "./types";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;

const canRead = (ctx: BellaSkillContext) => Boolean(ctx.companyId);

function competenceOf(payload: BellaSkillPayload): string {
  return typeof payload.competence === "string"
    ? toCompetence(payload.competence)
    : toCompetence();
}

/** Garante uma apuração para a competência (gera se ainda não existir). */
async function ensureApportionment(companyId: string, competence: string) {
  const existing = await taxQuery.apportionment(companyId, competence);
  if (existing) return existing;
  return taxQuery.generate(companyId, competence, false);
}

export const consultDasSkill: BellaSkill = {
  id: "tax.das",
  name: "Quanto pagarei de DAS?",
  module: "tax",
  description: "Valor do DAS da competência, com alíquota efetiva e vencimento.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const competence = competenceOf(payload);
    const ap = await ensureApportionment(ctx.companyId, competence);
    if (!ap) return skillResult.unavailable("Não consegui apurar os tributos desta competência.");
    return skillResult.success(
      [
        `DAS da competência ${ap.competence}: ${BRL.format(ap.taxAmount)}`,
        `Receita do mês: ${BRL.format(ap.revenue)}`,
        `RBT12: ${BRL.format(ap.rbt12)}`,
        `Alíquota efetiva: ${pct(ap.effectiveRate)} (nominal ${pct(ap.nominalRate)}, faixa ${ap.bracket ?? "-"})`,
        ap.dueDate ? `Vencimento: ${ap.dueDate}` : "Vencimento a definir.",
      ].join("\n"),
      ap,
    );
  },
};

export const taxReserveSkill: BellaSkill = {
  id: "tax.reserve",
  name: "Quanto devo reservar para impostos?",
  module: "tax",
  description: "Reserva de caixa recomendada para os tributos do mês.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const competence = competenceOf(payload);
    const ap = await ensureApportionment(ctx.companyId, competence);
    if (!ap) return skillResult.unavailable("Ainda não há apuração para calcular a reserva.");
    return skillResult.success(
      [
        `Reserve ${BRL.format(ap.taxAmount)} para os tributos de ${ap.competence}.`,
        `Isso equivale a ${pct(taxBurden(ap.taxAmount, ap.revenue))} da receita bruta do mês.`,
        ap.status === "paid" ? "Esta competência já está paga." : "Competência em aberto.",
      ].join("\n"),
      ap,
    );
  },
};

export const effectiveRateSkill: BellaSkill = {
  id: "tax.effective_rate",
  name: "Qual minha alíquota efetiva?",
  module: "tax",
  description: "Alíquota efetiva atual do Simples Nacional e faixa correspondente.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const competence = competenceOf(payload);
    const snap = await taxQuery.snapshot(ctx.companyId, competence);
    if (!snap) return skillResult.unavailable("Perfil tributário ainda não configurado.");
    if (snap.profile.taxRegime !== "simples_nacional" || !snap.profile.simplesAnnex) {
      return skillResult.success(
        `Regime ${snap.profile.taxRegime}: alíquota efetiva parametrizada em ${pct(
          snap.profile.effectiveRate,
        )}.`,
        snap.profile,
      );
    }
    const calc = await taxService.simulateSimples(
      snap.profile.simplesAnnex,
      snap.rbt12,
      snap.revenue,
    );
    return skillResult.success(
      [
        `Anexo ${calc.annex}, faixa ${calc.bracket}.`,
        `Alíquota nominal: ${pct(calc.nominalRate)} | parcela a deduzir: ${BRL.format(calc.deduction)}`,
        `Alíquota efetiva: ${pct(calc.effectiveRate)}`,
        `Uso do limite anual: ${pct(calc.limitUsagePct)}`,
      ].join("\n"),
      calc,
    );
  },
};

export const rbt12Skill: BellaSkill = {
  id: "tax.rbt12",
  name: "Meu RBT12 aumentou?",
  module: "tax",
  description: "Evolução da receita bruta acumulada dos últimos 12 meses.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const competence = competenceOf(payload);
    const snap = await taxQuery.snapshot(ctx.companyId, competence);
    if (!snap) return skillResult.unavailable("Perfil tributário ainda não configurado.");
    const prev = snap.previous?.rbt12 ?? null;
    const delta = prev == null ? null : snap.rbt12 - prev;
    return skillResult.success(
      [
        `RBT12 atual: ${BRL.format(snap.rbt12)}`,
        prev == null
          ? "Sem competência anterior apurada para comparação."
          : `Competência anterior: ${BRL.format(prev)} (${delta! >= 0 ? "+" : "-"}${BRL.format(
              Math.abs(delta!),
            )}).`,
        `Uso do limite do Simples: ${pct((snap.rbt12 / 4_800_000) * 100)}`,
      ].join("\n"),
      { rbt12: snap.rbt12, previous: prev, delta },
    );
  },
};

export const netProfitSkill: BellaSkill = {
  id: "tax.net_profit",
  name: "Quanto sobra líquido?",
  module: "tax",
  description: "Lucro líquido após tributos, com base no motor contábil.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const competence = competenceOf(payload);
    const result = await taxQuery.distributable(ctx.companyId, competence);
    if (!result) return skillResult.unavailable("Não consegui apurar o resultado do período.");
    return skillResult.success(
      [
        `Lucro líquido do período: ${BRL.format(result.netProfit)}`,
        `Tributos em aberto: ${BRL.format(result.pendingTaxes)}`,
        `Sobra efetiva: ${BRL.format(result.distributable)}`,
      ].join("\n"),
      result,
    );
  },
};

export const distributionSkill: BellaSkill = {
  id: "tax.distribution",
  name: "Quanto posso distribuir?",
  module: "tax",
  description: "Valor disponível para distribuição de lucros após reservar os tributos.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const competence = competenceOf(payload);
    const result = await taxQuery.distributable(ctx.companyId, competence);
    if (!result) return skillResult.unavailable("Não consegui apurar o lucro distribuível.");
    return skillResult.success(
      result.distributable > 0
        ? `Você pode distribuir até ${BRL.format(
            result.distributable,
          )} — já descontados ${BRL.format(result.pendingTaxes)} de tributos em aberto.`
        : "Não há lucro disponível para distribuição neste período após reservar os tributos.",
      result,
    );
  },
};

export const taxComparisonSkill: BellaSkill = {
  id: "tax.comparison",
  name: "Comparação mês a mês",
  module: "tax",
  description: "Histórico de receita, alíquota efetiva e DAS por competência.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const limit = typeof payload.months === "number" ? payload.months : 6;
    const history = await taxQuery.history(ctx.companyId, limit);
    if (!history.length) return skillResult.unavailable("Ainda não há apurações registradas.");
    const lines = history.map(
      (h) =>
        `${h.competence}: receita ${BRL.format(h.revenue)} | efetiva ${pct(
          h.effectiveRate,
        )} | DAS ${BRL.format(h.taxAmount)}`,
    );
    return skillResult.success(["Comparativo tributário:", ...lines].join("\n"), history);
  },
};

export const taxProjectionSkill: BellaSkill = {
  id: "tax.projection",
  name: "Projeção tributária",
  module: "tax",
  description: "Como DAS, lucro e margem mudam se as vendas crescerem 10%, 20% ou 30%.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const competence = competenceOf(payload);
    const projection = await taxQuery.projection(ctx.companyId, competence);
    if (!projection || !projection.scenarios.length) {
      return skillResult.unavailable("Não consegui projetar cenários para esta competência.");
    }
    const lines = projection.scenarios.map(
      (s) =>
        `+${s.growthPct}%: receita ${BRL.format(s.revenue)} | DAS ${BRL.format(
          s.taxAmount,
        )} | lucro ${BRL.format(s.netProfit)} (${pct(s.netMargin)})`,
    );
    return skillResult.success(
      [`Projeções a partir de ${BRL.format(projection.baseRevenue)}:`, ...lines].join("\n"),
      projection,
    );
  },
};

export const taxAlertsSkill: BellaSkill = {
  id: "tax.alerts",
  name: "Alertas tributários",
  module: "tax",
  description: "Mudança de faixa, alíquota crescente, DAS vencendo e limite do Simples.",
  canExecute: canRead,
  async execute(_payload, ctx) {
    const alerts = await import("../providers/modules/tax.provider").then((m) =>
      m.taxProvider.getAlerts({ companyId: ctx.companyId }),
    );
    if (!alerts.length) return skillResult.success("Nenhum alerta tributário no momento.", []);
    return skillResult.success(
      ["Alertas tributários:", ...alerts.map((a) => `• ${a.title} — ${a.description}`)].join("\n"),
      alerts,
    );
  },
};

export const generateApportionmentSkill: BellaSkill = {
  id: "tax.generate_apportionment",
  name: "Gerar apuração tributária",
  module: "tax",
  description: "Apura a competência e gera o lançamento contábil de tributos.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const competence = competenceOf(payload);
    const close = payload.close === true;
    const ap = await taxQuery.generate(ctx.companyId, competence, close);
    if (!ap) return skillResult.unavailable("Não consegui gerar a apuração desta competência.");
    return skillResult.success(
      `Apuração de ${ap.competence} gerada: ${BRL.format(ap.taxAmount)} (${pct(
        ap.effectiveRate,
      )}). Lançamento contábil registrado.`,
      ap,
    );
  },
};

export const taxSkills: BellaSkill[] = [
  consultDasSkill,
  taxReserveSkill,
  effectiveRateSkill,
  rbt12Skill,
  netProfitSkill,
  distributionSkill,
  taxComparisonSkill,
  taxProjectionSkill,
  taxAlertsSkill,
  generateApportionmentSkill,
];
