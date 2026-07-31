import { describe, expect, it } from "vitest";
import { todayProvider, trendsProvider } from "../providers";
import { getAccountingSkill, accountingAiSkills } from "../skills";
import { makeSummary, makeTestServices, testPeriod, testToday } from "./fixtures";

const deps = (opts = {}) => ({
  services: makeTestServices(opts),
  period: testPeriod,
  today: testToday,
});

describe("accounting-ai · providers de receita do dia e tendências", () => {
  it("today devolve faturamento do dia", async () => {
    const r = await todayProvider("c1", deps());
    expect(r.available).toBe(true);
    expect(r.data?.total).toBe(800);
    expect(r.data?.date).toBe(testToday);
  });

  it("trends compara hoje x ontem e mês x mês anterior", async () => {
    const r = await trendsProvider("c1", deps());
    expect(r.data?.todayVsYesterday.direction).toBe("up");
    expect(r.data?.monthVsPreviousRevenue.direction).toBe("up");
    expect(r.data?.monthVsPreviousProfit.hasHistory).toBe(true);
  });

  it("trends detecta queda em relação a ontem", async () => {
    const r = await trendsProvider("c1", deps({ yesterdayTotal: 2000 }));
    expect(r.data?.todayVsYesterday.direction).toBe("down");
  });

  it("sem histórico do mês anterior a comparação fica indisponível", async () => {
    const r = await trendsProvider("c1", deps({ noHistory: true }));
    expect(r.data?.monthVsPreviousRevenue.hasHistory).toBe(false);
    expect(r.data?.monthVsPreviousRevenue.label).toBe("sem histórico suficiente");
  });
});

describe("accounting-ai · falha parcial", () => {
  it("financeiro fora do ar não derruba o restante do summary", async () => {
    const s = await makeSummary({ breakFinance: true });
    expect(s.cash.available).toBe(false);
    expect(s.cashFlow.available).toBe(false);
    expect(s.revenue.available).toBe(true);
    expect(s.profit.available).toBe(true);
    expect(s.today.available).toBe(true);
    expect(s.inventory.available).toBe(true);
    expect(s.health.available).toBe(true);
  });
});

describe("accounting-ai · skills", () => {
  const ids = [
    "consultar_lucro",
    "consultar_receita",
    "consultar_fluxo",
    "consultar_caixa",
    "consultar_ticket",
    "consultar_produtos",
    "consultar_clientes",
    "consultar_saude",
  ] as const;

  it("todas as skills exigidas estão registradas e são somente leitura", () => {
    for (const id of ids) {
      const skill = getAccountingSkill(id);
      expect(skill, id).toBeDefined();
      expect(skill?.readOnly).toBe(true);
    }
    expect(accountingAiSkills.every((s) => s.readOnly)).toBe(true);
  });

  it("skills respondem com dados reais dos providers", async () => {
    for (const id of ids) {
      const res = await getAccountingSkill(id)!.run("c1", deps());
      expect(res.ok, id).toBe(true);
      expect(res.text.length, id).toBeGreaterThan(0);
    }
  });

  it("skill de caixa degrada quando o financeiro falha", async () => {
    const res = await getAccountingSkill("consultar_caixa")!.run("c1", deps({ breakFinance: true }));
    expect(res.ok).toBe(false);
    expect(res.text).toContain("Sem dados");
  });
});
