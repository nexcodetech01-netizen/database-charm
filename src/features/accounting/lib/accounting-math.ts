/**
 * Motor Contábil — matemática pura.
 *
 * Funções determinísticas usadas para validar partidas dobradas,
 * montar a árvore do plano de contas e derivar indicadores a partir
 * dos saldos reais retornados pelo banco. Sem I/O, 100% testável.
 */

import type {
  AccountingAccount,
  AccountingAccountNode,
  AccountingAccountType,
  AccountingEntryItemInput,
  DreReport,
} from "../types";

export const CENTS_TOLERANCE = 0.009;

export function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/** Tipos que aumentam o resultado (natureza credora no DRE). */
export const REVENUE_TYPES: AccountingAccountType[] = ["RECEITA", "OUTRAS_RECEITAS"];

/** Tipos que reduzem o resultado (natureza devedora no DRE). */
export const EXPENSE_TYPES: AccountingAccountType[] = [
  "DEDUCOES",
  "CMV",
  "DESPESA_OPERACIONAL",
  "DESPESA_FINANCEIRA",
  "OUTRAS_DESPESAS",
];

/* ------------------------------------------------------------------ */
/* Partidas dobradas                                                    */
/* ------------------------------------------------------------------ */

export interface DoubleEntryCheck {
  debit: number;
  credit: number;
  difference: number;
  balanced: boolean;
  errors: string[];
}

export function checkDoubleEntry(items: AccountingEntryItemInput[]): DoubleEntryCheck {
  const errors: string[] = [];
  let debit = 0;
  let credit = 0;

  const usable = items.filter((i) => round2(i.amount) > 0);
  if (usable.length === 0) errors.push("Lançamento sem partidas com valor.");

  for (const item of usable) {
    if (!item.code && !item.accountId) errors.push("Partida sem conta contábil.");
    if (item.side === "debit") debit += round2(item.amount);
    else if (item.side === "credit") credit += round2(item.amount);
    else errors.push(`Natureza inválida: ${String(item.side)}`);
  }

  debit = round2(debit);
  credit = round2(credit);
  const difference = round2(debit - credit);
  const balanced = Math.abs(difference) <= CENTS_TOLERANCE && usable.length > 0;
  if (!balanced && errors.length === 0) {
    errors.push(`Lançamento desbalanceado: débito ${debit} x crédito ${credit}.`);
  }
  return { debit, credit, difference, balanced, errors };
}

/** Estorno = espelho invertido das partidas originais. */
export function buildReversalItems(
  items: AccountingEntryItemInput[],
): AccountingEntryItemInput[] {
  return items
    .filter((i) => round2(i.amount) > 0)
    .map((i) => ({
      ...i,
      side: i.side === "debit" ? ("credit" as const) : ("debit" as const),
      memo: "Estorno",
    }));
}

/* ------------------------------------------------------------------ */
/* Plano de contas                                                      */
/* ------------------------------------------------------------------ */

export function buildAccountTree(accounts: AccountingAccount[]): AccountingAccountNode[] {
  const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code, "pt-BR"));
  const map = new Map<string, AccountingAccountNode>();
  for (const acc of sorted) {
    map.set(acc.id, { ...acc, children: [], level: acc.code.split(".").length - 1 });
  }
  const roots: AccountingAccountNode[] = [];
  for (const node of map.values()) {
    const parent = node.parentId ? map.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Apenas contas analíticas podem receber lançamento. */
export function assertPostable(account: AccountingAccount): void {
  if (!account.active) throw new Error(`Conta ${account.code} inativa.`);
  if (!account.acceptsPosting) {
    throw new Error(`Conta ${account.code} é sintética e não aceita lançamento.`);
  }
}

/* ------------------------------------------------------------------ */
/* Indicadores                                                          */
/* ------------------------------------------------------------------ */

export function safeDivide(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

export function marginPct(value: number, base: number): number {
  return round2(safeDivide(value, base) * 100);
}

export function calcEbitda(operatingResult: number, depreciation: number): number {
  return round2(operatingResult + depreciation);
}

/** Ponto de equilíbrio contábil = despesas fixas / margem de contribuição. */
export function calcBreakEven(
  operatingExpenses: number,
  netRevenue: number,
  cogs: number,
): number {
  const contributionMargin = safeDivide(netRevenue - cogs, netRevenue);
  if (contributionMargin <= 0) return 0;
  return round2(operatingExpenses / contributionMargin);
}

export interface DreDerived {
  ebitda: number;
  ebitdaMargin: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  breakEven: number;
}

export function deriveDreIndicators(dre: DreReport): DreDerived {
  const ebitda = calcEbitda(dre.operatingResult, dre.depreciation);
  return {
    ebitda,
    ebitdaMargin: marginPct(ebitda, dre.netRevenue),
    grossMargin: marginPct(dre.grossProfit, dre.netRevenue),
    operatingMargin: marginPct(dre.operatingResult, dre.netRevenue),
    netMargin: marginPct(dre.netProfit, dre.netRevenue),
    breakEven: calcBreakEven(dre.operatingExpenses, dre.netRevenue, dre.cogs),
  };
}

/** Ativo = Passivo + PL (com resultado do período dentro do PL). */
export function isBalanceSheetBalanced(
  assets: number,
  liabilities: number,
  equity: number,
): boolean {
  return Math.abs(round2(assets - (liabilities + equity))) <= 0.01;
}
