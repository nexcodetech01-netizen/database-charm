/**
 * Bella Contadora — Skills de consulta contábil.
 *
 * Todas as respostas vêm exclusivamente do motor contábil
 * (`accountingQuery` → `accountingService` → RPCs sobre partidas
 * dobradas). Nenhuma skill aqui altera dados.
 */

import { accountingQuery } from "../providers/modules/accounting.provider";
import { currentMonthRange } from "@/features/accounting";
import type { BellaSkill, BellaSkillContext, BellaSkillPayload } from "./types";
import { skillResult } from "./types";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;

function resolvePeriod(payload: BellaSkillPayload): { start: string; end: string } {
  const start = typeof payload.start === "string" ? payload.start : null;
  const end = typeof payload.end === "string" ? payload.end : null;
  const range = currentMonthRange();
  return { start: start ?? range.start, end: end ?? range.end };
}

const canRead = (ctx: BellaSkillContext) => Boolean(ctx.companyId);

export const consultDreSkill: BellaSkill = {
  id: "accounting.dre",
  name: "Consultar DRE",
  module: "accounting",
  description: "Demonstrativo de resultado do período a partir dos lançamentos contábeis.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const { start, end } = resolvePeriod(payload);
    const dre = await accountingQuery.dre(ctx.companyId, start, end);
    if (!dre) return skillResult.unavailable("Não consegui apurar o DRE deste período.");
    return skillResult.success(
      [
        `DRE ${start} a ${end}:`,
        `Receita bruta ${BRL.format(dre.grossRevenue)}`,
        `(-) Deduções ${BRL.format(dre.deductions)}`,
        `= Receita líquida ${BRL.format(dre.netRevenue)}`,
        `(-) CMV ${BRL.format(dre.cogs)}`,
        `= Lucro bruto ${BRL.format(dre.grossProfit)} (${pct(dre.grossMargin)})`,
        `(-) Despesas operacionais ${BRL.format(dre.operatingExpenses)}`,
        `= Resultado operacional ${BRL.format(dre.operatingResult)}`,
        `(-) Despesas financeiras ${BRL.format(dre.financialExpenses)}`,
        `= Lucro líquido ${BRL.format(dre.netProfit)} (${pct(dre.netMargin)})`,
      ].join("\n"),
      dre,
    );
  },
};

export const consultBalanceSheetSkill: BellaSkill = {
  id: "accounting.balance_sheet",
  name: "Consultar Balanço Patrimonial",
  module: "accounting",
  description: "Ativo, Passivo e Patrimônio Líquido apurados pelo motor contábil.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const asOf = typeof payload.asOf === "string" ? payload.asOf : undefined;
    const bs = await accountingQuery.balanceSheet(ctx.companyId, asOf);
    if (!bs) return skillResult.unavailable("Não consegui apurar o balanço.");
    return skillResult.success(
      [
        `Balanço em ${bs.asOf}:`,
        `Ativo ${BRL.format(bs.assets)}`,
        `Passivo ${BRL.format(bs.liabilities)}`,
        `Patrimônio líquido ${BRL.format(bs.equity)}`,
        bs.balanced ? "Balanço fechado (Ativo = Passivo + PL)." : `Divergência de ${BRL.format(bs.difference)}.`,
      ].join("\n"),
      bs,
    );
  },
};

export const consultEbitdaSkill: BellaSkill = {
  id: "accounting.ebitda",
  name: "Consultar EBITDA",
  module: "accounting",
  description: "EBITDA e margem EBITDA do período.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const { start, end } = resolvePeriod(payload);
    const dre = await accountingQuery.dre(ctx.companyId, start, end);
    if (!dre) return skillResult.unavailable("Não consegui apurar o EBITDA.");
    return skillResult.success(
      `EBITDA de ${start} a ${end}: ${BRL.format(dre.ebitda)} (margem ${pct(dre.ebitdaMargin)}).`,
      { ebitda: dre.ebitda, margin: dre.ebitdaMargin, depreciation: dre.depreciation },
    );
  },
};

export const consultProfitSkill: BellaSkill = {
  id: "accounting.profit",
  name: "Consultar Lucro",
  module: "accounting",
  description: "Lucro bruto, operacional e líquido do período.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const { start, end } = resolvePeriod(payload);
    const dre = await accountingQuery.dre(ctx.companyId, start, end);
    if (!dre) return skillResult.unavailable("Não consegui apurar o lucro.");
    return skillResult.success(
      `Lucro bruto ${BRL.format(dre.grossProfit)} · operacional ${BRL.format(dre.operatingResult)} · líquido ${BRL.format(dre.netProfit)}.`,
      {
        grossProfit: dre.grossProfit,
        operatingResult: dre.operatingResult,
        netProfit: dre.netProfit,
      },
    );
  },
};

export const consultMarginSkill: BellaSkill = {
  id: "accounting.margins",
  name: "Consultar Margens",
  module: "accounting",
  description: "Margem bruta, operacional, líquida e EBITDA.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const { start, end } = resolvePeriod(payload);
    const dre = await accountingQuery.dre(ctx.companyId, start, end);
    if (!dre) return skillResult.unavailable("Não consegui apurar as margens.");
    return skillResult.success(
      `Margem bruta ${pct(dre.grossMargin)} · operacional ${pct(dre.operatingMargin)} · líquida ${pct(dre.netMargin)} · EBITDA ${pct(dre.ebitdaMargin)}.`,
      {
        gross: dre.grossMargin,
        operating: dre.operatingMargin,
        net: dre.netMargin,
        ebitda: dre.ebitdaMargin,
      },
    );
  },
};

export const consultKpisSkill: BellaSkill = {
  id: "accounting.kpis",
  name: "Consultar Indicadores financeiros",
  module: "accounting",
  description: "Liquidez, capital de giro, endividamento, ROI, ROE, ticket médio, CMV% e despesas%.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const { start, end } = resolvePeriod(payload);
    const kpis = await accountingQuery.kpis(ctx.companyId, start, end);
    if (!kpis) return skillResult.unavailable("Não consegui apurar os indicadores.");
    return skillResult.success(
      [
        `Liquidez corrente: ${kpis.currentLiquidity == null ? "—" : kpis.currentLiquidity.toFixed(2).replace(".", ",")}`,
        `Capital de giro: ${BRL.format(kpis.workingCapital)}`,
        `Endividamento: ${pct(kpis.debtRatio)}`,
        `ROI: ${pct(kpis.roi)} · ROE: ${pct(kpis.roe)}`,
        `Ticket médio: ${BRL.format(kpis.averageTicket)} (${kpis.salesCount} vendas)`,
        `CMV: ${pct(kpis.cogsRatio)} · Despesas: ${pct(kpis.expenseRatio)}`,
        `Ponto de equilíbrio: ${BRL.format(kpis.breakEven)}`,
      ].join("\n"),
      kpis,
    );
  },
};

export const consultMonthlyEvolutionSkill: BellaSkill = {
  id: "accounting.monthly_evolution",
  name: "Consultar Evolução mensal",
  module: "accounting",
  description: "Evolução do resultado contábil nos últimos meses.",
  canExecute: canRead,
  async execute(payload, ctx) {
    const months = typeof payload.months === "number" && payload.months > 0 ? Math.min(payload.months, 12) : 6;
    const evolution = await accountingQuery.monthlyEvolution(ctx.companyId, months);
    if (!evolution) return skillResult.unavailable("Não consegui montar a evolução mensal.");
    const rows = evolution.map((m) => ({
      label: m.label,
      netRevenue: m.dre.netRevenue,
      grossProfit: m.dre.grossProfit,
      netProfit: m.dre.netProfit,
      ebitda: m.dre.ebitda,
    }));
    return skillResult.success(
      rows
        .map((r) => `${r.label}: receita ${BRL.format(r.netRevenue)} · lucro ${BRL.format(r.netProfit)}`)
        .join("\n"),
      rows,
    );
  },
};

export const accountingSkills: BellaSkill[] = [
  consultDreSkill,
  consultBalanceSheetSkill,
  consultEbitdaSkill,
  consultProfitSkill,
  consultMarginSkill,
  consultKpisSkill,
  consultMonthlyEvolutionSkill,
];
