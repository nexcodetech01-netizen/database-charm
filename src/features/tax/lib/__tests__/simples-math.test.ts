/**
 * Motor Tributário — testes da matemática pura.
 *
 * Cobre TODAS as faixas de TODOS os anexos do Simples, a alíquota
 * efetiva, o DAS, mudanças de faixa/anexo, RBT12, projeções e alertas.
 */

import { describe, expect, it } from "vitest";
import {
  SIMPLES_ANNEXES,
  SIMPLES_BRACKETS,
  SIMPLES_LIMIT,
  buildTaxAlerts,
  computeSimples,
  distributableProfit,
  effectiveRate,
  findBracket,
  projectScenario,
  projectScenarios,
  round2,
  round4,
  taxBurden,
  taxReserve,
} from "../simples-math";
import type { SimplesAnnex, TaxApportionment } from "../../types";

const apportionment = (over: Partial<TaxApportionment> = {}): TaxApportionment => ({
  id: "a1",
  companyId: "c1",
  competence: "2026-06-01",
  taxRegime: "simples_nacional",
  simplesAnnex: "I",
  bracket: 1,
  revenue: 10_000,
  baseAmount: 10_000,
  rbt12: 120_000,
  nominalRate: 4,
  deduction: 0,
  effectiveRate: 4,
  taxAmount: 400,
  dueDate: "2026-07-20",
  status: "open",
  entryId: null,
  ...over,
});

describe("arredondamentos", () => {
  it("round2 e round4 tratam valores inválidos", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(Number.NaN)).toBe(0);
    expect(round4(1.234567)).toBe(1.2346);
    expect(round4(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("findBracket — todas as faixas de todos os anexos", () => {
  for (const annex of SIMPLES_ANNEXES) {
    const rows = SIMPLES_BRACKETS.filter((r) => r.annex === annex);
    for (const row of rows) {
      it(`anexo ${annex} faixa ${row.bracket} no piso e no teto`, () => {
        expect(findBracket(annex, row.rbt12From).bracket).toBe(row.bracket);
        expect(findBracket(annex, row.rbt12To!).bracket).toBe(row.bracket);
      });
    }

    it(`anexo ${annex} acima do teto cai na 6ª faixa`, () => {
      expect(findBracket(annex, SIMPLES_LIMIT + 1).bracket).toBe(6);
    });

    it(`anexo ${annex} com RBT12 negativo usa a 1ª faixa`, () => {
      expect(findBracket(annex, -50_000).bracket).toBe(1);
    });
  }

  it("anexo inexistente dispara erro", () => {
    expect(() => findBracket("Z" as SimplesAnnex, 1000)).toThrow(/Anexo do Simples/);
  });
});

describe("alíquota efetiva e DAS", () => {
  it("sem histórico (RBT12 = 0) usa a alíquota nominal", () => {
    const calc = computeSimples("I", 0, 10_000);
    expect(calc.effectiveRate).toBe(4);
    expect(calc.taxAmount).toBe(400);
    expect(calc.bracket).toBe(1);
  });

  it("Anexo I faixa 2 — (RBT12 × nominal − dedução) ÷ RBT12", () => {
    const calc = computeSimples("I", 300_000, 25_000);
    // (300000 * 0.073 - 5940) / 300000 = 5,3200%
    expect(calc.effectiveRate).toBeCloseTo(5.32, 4);
    expect(calc.taxAmount).toBe(round2(25_000 * 0.0532));
  });

  it("Anexo III faixa 5 confere com a fórmula oficial", () => {
    const calc = computeSimples("III", 2_000_000, 150_000);
    const expected = ((2_000_000 * 0.21 - 125_640) / 2_000_000) * 100;
    expect(calc.effectiveRate).toBeCloseTo(round4(expected), 4);
    expect(calc.taxAmount).toBe(round2((150_000 * calc.effectiveRate) / 100));
  });

  it("alíquota efetiva nunca é negativa", () => {
    const bracket = { ...SIMPLES_BRACKETS[1], deduction: 10_000_000 };
    expect(effectiveRate(bracket, 100_000)).toBe(0);
  });

  it("efetiva cresce ao mudar de faixa dentro do mesmo anexo", () => {
    const f1 = computeSimples("I", 100_000, 10_000);
    const f3 = computeSimples("I", 700_000, 10_000);
    expect(f3.effectiveRate).toBeGreaterThan(f1.effectiveRate);
    expect(f3.bracket).toBe(3);
  });

  it("todas as combinações anexo × faixa produzem DAS coerente", () => {
    for (const row of SIMPLES_BRACKETS) {
      const rbt12 = Math.max(row.rbt12From, 1);
      const calc = computeSimples(row.annex, rbt12, 20_000);
      expect(calc.effectiveRate).toBeGreaterThanOrEqual(0);
      expect(calc.effectiveRate).toBeLessThanOrEqual(row.nominalRate);
      expect(calc.taxAmount).toBe(round2((20_000 * calc.effectiveRate) / 100));
      expect(calc.limitUsagePct).toBe(round2((rbt12 / SIMPLES_LIMIT) * 100));
    }
  });

  it("receita negativa é tratada como zero", () => {
    expect(computeSimples("II", 200_000, -5_000).taxAmount).toBe(0);
  });
});

describe("reserva e carga tributária", () => {
  it("calcula reserva de caixa", () => {
    expect(taxReserve(10_000, 6)).toBe(600);
    expect(taxReserve(-10, 6)).toBe(0);
    expect(taxReserve(10_000, -3)).toBe(0);
  });

  it("carga tributária sobre a receita", () => {
    expect(taxBurden(600, 10_000)).toBe(6);
    expect(taxBurden(600, 0)).toBe(0);
  });
});

describe("projeções", () => {
  const base = {
    annex: "I" as SimplesAnnex,
    rbt12: 300_000,
    revenue: 25_000,
    cogsRatio: 0.4,
    operatingExpenses: 5_000,
  };

  it("cenário 0% mantém a receita", () => {
    const s = projectScenario(base, 0);
    expect(s.revenue).toBe(25_000);
    expect(s.cogs).toBe(10_000);
    expect(s.netProfit).toBe(round2(25_000 - 10_000 - 5_000 - s.taxAmount));
  });

  it("crescimento aumenta receita, DAS e lucro", () => {
    const [s0, s10, s20, s30] = projectScenarios(base);
    expect(s10.revenue).toBe(27_500);
    expect(s30.revenue).toBe(32_500);
    expect(s10.taxAmount).toBeGreaterThan(s0.taxAmount);
    expect(s30.netProfit).toBeGreaterThan(s20.netProfit);
    expect(s20.netMargin).toBeGreaterThan(0);
  });

  it("receita zero devolve margem zero", () => {
    const s = projectScenario({ ...base, revenue: 0 }, 10);
    expect(s.netMargin).toBe(0);
  });

  it("ratios negativos são normalizados", () => {
    const s = projectScenario({ ...base, cogsRatio: -1, operatingExpenses: -100 }, 0);
    expect(s.cogs).toBe(0);
    expect(s.operatingExpenses).toBe(0);
  });

  it("distribuição desconta tributos em aberto", () => {
    expect(distributableProfit(10_000, 2_500)).toBe(7_500);
    expect(distributableProfit(1_000, 5_000)).toBe(0);
    expect(distributableProfit(1_000, -5_000)).toBe(1_000);
  });
});

describe("alertas tributários", () => {
  const today = new Date("2026-07-18T12:00:00");

  it("sem anexo e sem apurações não gera alertas", () => {
    expect(
      buildTaxAlerts({ annex: null, rbt12: 0, current: null, previous: null, today }),
    ).toEqual([]);
  });

  it("avisa quando a receita se aproxima do limite", () => {
    const alerts = buildTaxAlerts({
      annex: "I",
      rbt12: 4_000_000,
      current: null,
      previous: null,
      today,
    });
    expect(alerts.map((a) => a.id)).toContain("tax.limit_near");
  });

  it("alerta crítico ao ultrapassar o limite", () => {
    const alerts = buildTaxAlerts({
      annex: "I",
      rbt12: 5_000_000,
      current: null,
      previous: null,
      today,
    });
    const limit = alerts.find((a) => a.id === "tax.limit_exceeded");
    expect(limit?.level).toBe("critical");
  });

  it("avisa mudança de faixa próxima", () => {
    const alerts = buildTaxAlerts({
      annex: "I",
      rbt12: 179_000,
      current: null,
      previous: null,
      today,
    });
    expect(alerts.map((a) => a.id)).toContain("tax.bracket_change_near");
  });

  it("detecta mudança de faixa, de anexo e alíquota crescente", () => {
    const alerts = buildTaxAlerts({
      annex: "I",
      rbt12: 500_000,
      previous: apportionment({ bracket: 1, simplesAnnex: "I", effectiveRate: 4 }),
      current: apportionment({
        bracket: 3,
        simplesAnnex: "III",
        effectiveRate: 9.6,
        dueDate: null,
      }),
      today,
    });
    const ids = alerts.map((a) => a.id);
    expect(ids).toContain("tax.bracket_changed");
    expect(ids).toContain("tax.annex_changed");
    expect(ids).toContain("tax.rate_increasing");
  });

  it("avisa DAS vencendo e DAS vencido", () => {
    const soon = buildTaxAlerts({
      annex: "I",
      rbt12: 100_000,
      current: apportionment({ dueDate: "2026-07-20" }),
      previous: null,
      today,
    });
    expect(soon.map((a) => a.id)).toContain("tax.das_due_soon");

    const late = buildTaxAlerts({
      annex: "I",
      rbt12: 100_000,
      current: apportionment({ dueDate: "2026-06-20" }),
      previous: null,
      today,
    });
    expect(late.find((a) => a.id === "tax.das_overdue")?.level).toBe("critical");
  });

  it("competência paga não gera alerta de vencimento", () => {
    const alerts = buildTaxAlerts({
      annex: "I",
      rbt12: 100_000,
      current: apportionment({ dueDate: "2026-06-20", status: "paid" }),
      previous: null,
      today,
    });
    expect(alerts.map((a) => a.id)).not.toContain("tax.das_overdue");
  });
});
