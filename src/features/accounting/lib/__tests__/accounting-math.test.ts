import { describe, expect, it } from "vitest";
import {
  assertPostable,
  buildAccountTree,
  buildReversalItems,
  calcBreakEven,
  calcEbitda,
  checkDoubleEntry,
  deriveDreIndicators,
  isBalanceSheetBalanced,
  marginPct,
  round2,
  safeDivide,
  EXPENSE_TYPES,
  REVENUE_TYPES,
} from "../accounting-math";
import { currentMonthRange, lastNMonths, monthRange } from "../periods";
import type { AccountingAccount, DreReport } from "../../types";

const account = (over: Partial<AccountingAccount>): AccountingAccount => ({
  id: over.id ?? "a1",
  companyId: "c1",
  code: over.code ?? "1",
  name: over.name ?? "Conta",
  type: over.type ?? "ATIVO",
  nature: over.nature ?? "debit",
  parentId: over.parentId ?? null,
  acceptsPosting: over.acceptsPosting ?? true,
  isDepreciation: over.isDepreciation ?? false,
  active: over.active ?? true,
});

describe("partidas dobradas", () => {
  it("aceita lançamento balanceado", () => {
    const r = checkDoubleEntry([
      { code: "1.1.03", side: "debit", amount: 100 },
      { code: "4.1.01", side: "credit", amount: 100 },
    ]);
    expect(r.balanced).toBe(true);
    expect(r.debit).toBe(100);
    expect(r.credit).toBe(100);
    expect(r.errors).toHaveLength(0);
  });

  it("aceita múltiplas partidas com desconto", () => {
    const r = checkDoubleEntry([
      { code: "1.1.03", side: "debit", amount: 90 },
      { code: "4.2.01", side: "debit", amount: 10 },
      { code: "4.1.01", side: "credit", amount: 100 },
    ]);
    expect(r.balanced).toBe(true);
    expect(r.difference).toBe(0);
  });

  it("rejeita lançamento desbalanceado", () => {
    const r = checkDoubleEntry([
      { code: "1.1.03", side: "debit", amount: 100 },
      { code: "4.1.01", side: "credit", amount: 90 },
    ]);
    expect(r.balanced).toBe(false);
    expect(r.difference).toBe(10);
    expect(r.errors[0]).toContain("desbalanceado");
  });

  it("rejeita lançamento vazio ou com valores zerados", () => {
    expect(checkDoubleEntry([]).balanced).toBe(false);
    expect(checkDoubleEntry([{ code: "1.1.01", side: "debit", amount: 0 }]).balanced).toBe(false);
  });

  it("rejeita partida sem conta e com side inválido", () => {
    const r = checkDoubleEntry([
      { side: "debit", amount: 10 },
      // @ts-expect-error validação em runtime
      { code: "4.1.01", side: "middle", amount: 10 },
    ]);
    expect(r.balanced).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("tolera diferença abaixo de meio centavo", () => {
    const r = checkDoubleEntry([
      { code: "1.1.03", side: "debit", amount: 100.004 },
      { code: "4.1.01", side: "credit", amount: 100 },
    ]);
    expect(r.balanced).toBe(true);
  });

  it("gera estorno espelhado e balanceado", () => {
    const items = [
      { code: "1.1.03", side: "debit" as const, amount: 100 },
      { code: "4.1.01", side: "credit" as const, amount: 100 },
    ];
    const rev = buildReversalItems(items);
    expect(rev[0].side).toBe("credit");
    expect(rev[1].side).toBe("debit");
    expect(checkDoubleEntry(rev).balanced).toBe(true);
    expect(rev.every((i) => i.memo === "Estorno")).toBe(true);
  });

  it("estorno ignora partidas zeradas", () => {
    expect(buildReversalItems([{ code: "x", side: "debit", amount: 0 }])).toHaveLength(0);
  });
});

describe("plano de contas", () => {
  const accounts = [
    account({ id: "1", code: "1", name: "Ativo", acceptsPosting: false }),
    account({ id: "11", code: "1.1", name: "Circulante", parentId: "1", acceptsPosting: false }),
    account({ id: "1101", code: "1.1.01", name: "Caixa", parentId: "11" }),
    account({ id: "4", code: "4", name: "Receita", type: "RECEITA", nature: "credit", acceptsPosting: false }),
  ];

  it("monta árvore hierárquica", () => {
    const tree = buildAccountTree(accounts);
    expect(tree).toHaveLength(2);
    expect(tree[0].children[0].children[0].name).toBe("Caixa");
  });

  it("calcula o nível pelo código", () => {
    const tree = buildAccountTree(accounts);
    expect(tree[0].level).toBe(0);
    expect(tree[0].children[0].children[0].level).toBe(2);
  });

  it("bloqueia lançamento em conta sintética ou inativa", () => {
    expect(() => assertPostable(accounts[0])).toThrow(/sintética/);
    expect(() => assertPostable(account({ active: false, code: "9.9" }))).toThrow(/inativa/);
    expect(() => assertPostable(accounts[2])).not.toThrow();
  });

  it("classifica tipos de resultado", () => {
    expect(REVENUE_TYPES).toContain("RECEITA");
    expect(EXPENSE_TYPES).toEqual(
      expect.arrayContaining(["CMV", "DEDUCOES", "DESPESA_OPERACIONAL", "DESPESA_FINANCEIRA"]),
    );
  });
});

const dre: DreReport = {
  period: { start: "2026-01-01", end: "2026-01-31" },
  grossRevenue: 10000,
  deductions: 500,
  netRevenue: 9500,
  cogs: 4500,
  grossProfit: 5000,
  operatingExpenses: 3000,
  operatingResult: 2000,
  financialExpenses: 200,
  otherRevenues: 0,
  otherExpenses: 0,
  resultBeforeTaxes: 1800,
  netProfit: 1800,
  depreciation: 300,
  ebitda: 2300,
  grossMargin: 52.63,
  operatingMargin: 21.05,
  netMargin: 18.95,
  ebitdaMargin: 24.21,
  lines: [],
};

describe("DRE, EBITDA e indicadores", () => {
  it("calcula EBITDA somando depreciação ao resultado operacional", () => {
    expect(calcEbitda(2000, 300)).toBe(2300);
    expect(calcEbitda(-500, 100)).toBe(-400);
  });

  it("deriva margens do DRE", () => {
    const d = deriveDreIndicators(dre);
    expect(d.ebitda).toBe(2300);
    expect(d.grossMargin).toBe(52.63);
    expect(d.operatingMargin).toBe(21.05);
    expect(d.netMargin).toBe(18.95);
    expect(d.ebitdaMargin).toBe(24.21);
  });

  it("zera margens quando não há receita", () => {
    const empty = deriveDreIndicators({ ...dre, netRevenue: 0, grossProfit: 0, operatingResult: 0, netProfit: 0 });
    expect(empty.grossMargin).toBe(0);
    expect(empty.netMargin).toBe(0);
    expect(empty.breakEven).toBe(0);
  });

  it("calcula ponto de equilíbrio", () => {
    expect(calcBreakEven(3000, 9500, 4500)).toBe(5700);
    expect(calcBreakEven(3000, 1000, 1500)).toBe(0);
  });

  it("protege divisões por zero", () => {
    expect(safeDivide(10, 0)).toBe(0);
    expect(marginPct(10, 0)).toBe(0);
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(10.555)).toBe(10.56);
  });
});

describe("balanço patrimonial", () => {
  it("valida Ativo = Passivo + PL", () => {
    expect(isBalanceSheetBalanced(1000, 400, 600)).toBe(true);
    expect(isBalanceSheetBalanced(1000, 400, 599.995)).toBe(true);
    expect(isBalanceSheetBalanced(1000, 400, 500)).toBe(false);
  });
});

describe("períodos contábeis", () => {
  it("monta o intervalo de um mês", () => {
    expect(monthRange(2026, 2)).toEqual({ start: "2026-02-01", end: "2026-02-28", label: "02/2026" });
    expect(monthRange(2024, 2).end).toBe("2024-02-29");
  });

  it("retorna o mês corrente e os últimos N meses", () => {
    const ref = new Date(2026, 6, 15);
    expect(currentMonthRange(ref).label).toBe("07/2026");
    const months = lastNMonths(3, ref);
    expect(months.map((m) => m.label)).toEqual(["05/2026", "06/2026", "07/2026"]);
  });
});
