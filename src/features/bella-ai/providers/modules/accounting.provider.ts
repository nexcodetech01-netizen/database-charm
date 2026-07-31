/**
 * Bella Contadora — provider contábil.
 *
 * Consome EXCLUSIVAMENTE o motor contábil (`accountingService`), que por
 * sua vez lê apenas lançamentos reais em partidas dobradas. Sem mocks:
 * quando não há dados no período, o provider devolve listas vazias.
 */

import {
  accountingService,
  currentMonthRange,
  lastNMonths,
  type BalanceSheetReport,
  type DreReport,
  type FinancialKpis,
} from "@/features/accounting";
import type {
  BellaAlert,
  BellaInsight,
  BellaMetric,
  BellaModuleProvider,
  BellaProviderContext,
  BellaSuggestion,
  BellaSummary,
} from "./base";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export interface AccountingSnapshot {
  dre: DreReport;
  balanceSheet: BalanceSheetReport;
  kpis: FinancialKpis;
}

export const accountingQuery = {
  async currentDre(companyId: string): Promise<DreReport | null> {
    const { start, end } = currentMonthRange();
    return safe(() => accountingService.dre(companyId, start, end));
  },

  async dre(companyId: string, start: string, end: string): Promise<DreReport | null> {
    return safe(() => accountingService.dre(companyId, start, end));
  },

  async balanceSheet(companyId: string, asOf?: string): Promise<BalanceSheetReport | null> {
    const date = asOf ?? currentMonthRange().end;
    return safe(() => accountingService.balanceSheet(companyId, date));
  },

  async kpis(companyId: string, start?: string, end?: string): Promise<FinancialKpis | null> {
    const range = currentMonthRange();
    return safe(() => accountingService.kpis(companyId, start ?? range.start, end ?? range.end));
  },

  async monthlyEvolution(companyId: string, months = 6) {
    return safe(() => accountingService.monthlyEvolution(companyId, lastNMonths(months)));
  },

  async snapshot(companyId: string): Promise<AccountingSnapshot | null> {
    const { start, end } = currentMonthRange();
    const [dre, balanceSheet, kpis] = await Promise.all([
      safe(() => accountingService.dre(companyId, start, end)),
      safe(() => accountingService.balanceSheet(companyId, end)),
      safe(() => accountingService.kpis(companyId, start, end)),
    ]);
    if (!dre || !balanceSheet || !kpis) return null;
    return { dre, balanceSheet, kpis };
  },
};

export const accountingProvider: BellaModuleProvider = {
  module: "accounting",
  displayName: "Bella Contadora",

  async getSummary(ctx: BellaProviderContext): Promise<BellaSummary> {
    const snap = await accountingQuery.snapshot(ctx.companyId);
    const now = new Date().toISOString();
    if (!snap) {
      return {
        module: "accounting",
        headline: "Sem lançamentos contábeis no período.",
        highlights: [],
        updatedAt: now,
      };
    }
    const { dre, balanceSheet } = snap;
    return {
      module: "accounting",
      headline: `Lucro líquido do mês: ${BRL.format(dre.netProfit)} (${pct(dre.netMargin)}).`,
      highlights: [
        `Receita líquida: ${BRL.format(dre.netRevenue)}`,
        `Lucro bruto: ${BRL.format(dre.grossProfit)} (${pct(dre.grossMargin)})`,
        `EBITDA: ${BRL.format(dre.ebitda)} (${pct(dre.ebitdaMargin)})`,
        `Patrimônio líquido: ${BRL.format(balanceSheet.equity)}`,
      ],
      updatedAt: now,
    };
  },

  async getMetrics(ctx: BellaProviderContext): Promise<BellaMetric[]> {
    const snap = await accountingQuery.snapshot(ctx.companyId);
    if (!snap) return [];
    const { dre, kpis } = snap;
    return [
      { key: "net_revenue", label: "Receita líquida", value: BRL.format(dre.netRevenue) },
      { key: "gross_profit", label: "Lucro bruto", value: BRL.format(dre.grossProfit), hint: pct(dre.grossMargin) },
      { key: "operating_result", label: "Resultado operacional", value: BRL.format(dre.operatingResult) },
      { key: "net_profit", label: "Lucro líquido", value: BRL.format(dre.netProfit), hint: pct(dre.netMargin),
        trend: dre.netProfit > 0 ? "up" : dre.netProfit < 0 ? "down" : "flat" },
      { key: "ebitda", label: "EBITDA", value: BRL.format(dre.ebitda), hint: pct(dre.ebitdaMargin) },
      { key: "break_even", label: "Ponto de equilíbrio", value: BRL.format(kpis.breakEven) },
      { key: "working_capital", label: "Capital de giro", value: BRL.format(kpis.workingCapital) },
      { key: "current_liquidity", label: "Liquidez corrente",
        value: kpis.currentLiquidity == null ? "—" : kpis.currentLiquidity.toFixed(2).replace(".", ",") },
    ];
  },

  async getInsights(ctx: BellaProviderContext): Promise<BellaInsight[]> {
    const snap = await accountingQuery.snapshot(ctx.companyId);
    if (!snap) return [];
    const now = new Date().toISOString();
    const out: BellaInsight[] = [];
    const { dre, kpis } = snap;

    if (dre.netRevenue > 0 && dre.netProfit < 0) {
      out.push({
        id: "acc-negative-result",
        module: "accounting",
        title: "Resultado negativo no mês",
        description: `Prejuízo de ${BRL.format(Math.abs(dre.netProfit))} sobre receita líquida de ${BRL.format(dre.netRevenue)}.`,
        priority: "urgent",
        createdAt: now,
      });
    }
    if (dre.netRevenue > 0 && kpis.cogsRatio > 60) {
      out.push({
        id: "acc-high-cogs",
        module: "accounting",
        title: "CMV acima de 60% da receita",
        description: `O custo das mercadorias vendidas representa ${pct(kpis.cogsRatio)} da receita líquida.`,
        priority: "high",
        createdAt: now,
      });
    }
    if (dre.netRevenue > 0 && kpis.breakEven > dre.netRevenue) {
      out.push({
        id: "acc-below-breakeven",
        module: "accounting",
        title: "Receita abaixo do ponto de equilíbrio",
        description: `Seria necessário faturar ${BRL.format(kpis.breakEven)} para cobrir as despesas do período.`,
        priority: "high",
        createdAt: now,
      });
    }
    return out;
  },

  async getAlerts(ctx: BellaProviderContext): Promise<BellaAlert[]> {
    const bs = await accountingQuery.balanceSheet(ctx.companyId);
    if (!bs) return [];
    const out: BellaAlert[] = [];
    const now = new Date().toISOString();
    if (!bs.balanced) {
      out.push({
        id: "acc-unbalanced",
        module: "accounting",
        title: "Balanço fora de equilíbrio",
        description: `Diferença de ${BRL.format(bs.difference)} entre Ativo e Passivo + PL.`,
        severity: "critical",
        createdAt: now,
      });
    }
    if (bs.equity < 0) {
      out.push({
        id: "acc-negative-equity",
        module: "accounting",
        title: "Patrimônio líquido negativo",
        description: `PL apurado: ${BRL.format(bs.equity)}.`,
        severity: "warning",
        createdAt: now,
      });
    }
    return out;
  },

  async getSuggestions(ctx: BellaProviderContext): Promise<BellaSuggestion[]> {
    const snap = await accountingQuery.snapshot(ctx.companyId);
    if (!snap) return [];
    const out: BellaSuggestion[] = [];
    if (snap.kpis.expenseRatio > 30) {
      out.push({
        id: "acc-review-expenses",
        module: "accounting",
        title: "Revisar despesas operacionais",
        description: `As despesas operacionais consomem ${pct(snap.kpis.expenseRatio)} da receita líquida.`,
        actionLabel: "Ver DRE",
        priority: "medium",
      });
    }
    if (snap.kpis.currentLiquidity != null && snap.kpis.currentLiquidity < 1) {
      out.push({
        id: "acc-liquidity",
        module: "accounting",
        title: "Liquidez corrente abaixo de 1,0",
        description: "As obrigações de curto prazo superam os ativos circulantes.",
        actionLabel: "Ver balanço",
        priority: "high",
      });
    }
    return out;
  },
};
