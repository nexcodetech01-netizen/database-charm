/**
 * Motor Contábil — service.
 *
 * Camada única de acesso ao motor contábil no banco. Nenhuma regra é
 * duplicada: DRE, Balanço e KPIs vêm de RPCs que leem exclusivamente
 * os lançamentos em partidas dobradas.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  AccountingAccount,
  AccountingBalanceLine,
  BalanceSheetReport,
  DreReport,
  FinancialKpis,
} from "../types";

type Json = Record<string, unknown>;

const num = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? Number(n) : 0;
};

function mapLines(raw: unknown): AccountingBalanceLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l) => {
    const line = l as Json;
    return {
      code: String(line.code ?? ""),
      name: String(line.name ?? ""),
      type: line.type as AccountingBalanceLine["type"],
      amount: num(line.amount),
    };
  });
}

function mapDre(raw: Json): DreReport {
  const period = (raw.period ?? {}) as Json;
  return {
    period: { start: String(period.start ?? ""), end: String(period.end ?? "") },
    grossRevenue: num(raw.gross_revenue),
    deductions: num(raw.deductions),
    netRevenue: num(raw.net_revenue),
    cogs: num(raw.cogs),
    grossProfit: num(raw.gross_profit),
    operatingExpenses: num(raw.operating_expenses),
    operatingResult: num(raw.operating_result),
    financialExpenses: num(raw.financial_expenses),
    otherRevenues: num(raw.other_revenues),
    otherExpenses: num(raw.other_expenses),
    resultBeforeTaxes: num(raw.result_before_taxes),
    netProfit: num(raw.net_profit),
    depreciation: num(raw.depreciation),
    ebitda: num(raw.ebitda),
    grossMargin: num(raw.gross_margin),
    operatingMargin: num(raw.operating_margin),
    netMargin: num(raw.net_margin),
    ebitdaMargin: num(raw.ebitda_margin),
    lines: mapLines(raw.lines),
  };
}

function mapBalanceSheet(raw: Json): BalanceSheetReport {
  return {
    asOf: String(raw.as_of ?? ""),
    assets: num(raw.assets),
    liabilities: num(raw.liabilities),
    equity: num(raw.equity),
    equityCapital: num(raw.equity_capital),
    periodResult: num(raw.period_result),
    balanced: Boolean(raw.balanced),
    difference: num(raw.difference),
    lines: mapLines(raw.lines),
  };
}

function mapKpis(raw: Json): FinancialKpis {
  const period = (raw.period ?? {}) as Json;
  return {
    period: { start: String(period.start ?? ""), end: String(period.end ?? "") },
    currentLiquidity: raw.current_liquidity == null ? null : num(raw.current_liquidity),
    workingCapital: num(raw.working_capital),
    debtRatio: num(raw.debt_ratio),
    grossMargin: num(raw.gross_margin),
    operatingMargin: num(raw.operating_margin),
    netMargin: num(raw.net_margin),
    ebitda: num(raw.ebitda),
    ebitdaMargin: num(raw.ebitda_margin),
    roi: num(raw.roi),
    roe: num(raw.roe),
    averageTicket: num(raw.average_ticket),
    salesCount: Math.trunc(num(raw.sales_count)),
    cogsRatio: num(raw.cogs_ratio),
    expenseRatio: num(raw.expense_ratio),
    breakEven: num(raw.break_even),
  };
}

export const accountingService = {
  async chartOfAccounts(companyId: string): Promise<AccountingAccount[]> {
    const { data, error } = await supabase
      .from("accounting_accounts")
      .select("id, company_id, code, name, type, nature, parent_id, accepts_posting, is_depreciation, active")
      .eq("company_id", companyId)
      .order("code");
    if (error) throw error;
    return (data ?? []).map((a) => ({
      id: a.id,
      companyId: a.company_id,
      code: a.code,
      name: a.name,
      type: a.type as AccountingAccount["type"],
      nature: a.nature as AccountingAccount["nature"],
      parentId: a.parent_id,
      acceptsPosting: a.accepts_posting,
      isDepreciation: a.is_depreciation,
      active: a.active,
    }));
  },

  async dre(companyId: string, start: string, end: string): Promise<DreReport> {
    const { data, error } = await supabase.rpc("generate_dre", {
      _company_id: companyId,
      _start: start,
      _end: end,
    });
    if (error) throw error;
    return mapDre((data ?? {}) as Json);
  },

  async balanceSheet(companyId: string, asOf: string): Promise<BalanceSheetReport> {
    const { data, error } = await supabase.rpc("generate_balance_sheet", {
      _company_id: companyId,
      _as_of: asOf,
    });
    if (error) throw error;
    return mapBalanceSheet((data ?? {}) as Json);
  },

  async kpis(companyId: string, start: string, end: string): Promise<FinancialKpis> {
    const { data, error } = await supabase.rpc("financial_kpis", {
      _company_id: companyId,
      _start: start,
      _end: end,
    });
    if (error) throw error;
    return mapKpis((data ?? {}) as Json);
  },

  /** Evolução mensal do resultado — usa exclusivamente o motor contábil. */
  async monthlyEvolution(
    companyId: string,
    months: { start: string; end: string; label: string }[],
  ): Promise<{ label: string; dre: DreReport }[]> {
    const results = await Promise.all(
      months.map(async (m) => ({
        label: m.label,
        dre: await accountingService.dre(companyId, m.start, m.end),
      })),
    );
    return results;
  },
};

export type AccountingService = typeof accountingService;
