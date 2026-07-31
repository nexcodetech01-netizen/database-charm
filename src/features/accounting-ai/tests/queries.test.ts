import { describe, expect, it } from "vitest";
import { computeTrend, directionSymbol, NO_HISTORY_LABEL } from "../lib/trend";
import { previousDayISO, previousMonthPeriod, dayPeriod, todayISO } from "../lib/helpers";
import { healthLabel } from "../lib/health";
import { buildExecutiveBrief, greetingFor } from "../lib/brief";
import { accountingQueries, runAllAccountingQueries } from "../queries";
import { makeSummary } from "./fixtures";

describe("accounting-ai · trend", () => {
  it("marca sem histórico quando não há período anterior", () => {
    const t = computeTrend(100, null);
    expect(t.hasHistory).toBe(false);
    expect(t.direction).toBe("unknown");
    expect(t.label).toBe(NO_HISTORY_LABEL);
  });

  it("detecta crescimento", () => {
    const t = computeTrend(150, 100);
    expect(t.direction).toBe("up");
    expect(t.deltaPercent).toBeCloseTo(50);
  });

  it("detecta queda", () => {
    const t = computeTrend(80, 100);
    expect(t.direction).toBe("down");
    expect(t.delta).toBe(-20);
  });

  it("detecta estabilidade dentro da tolerância", () => {
    const t = computeTrend(100.2, 100);
    expect(t.direction).toBe("flat");
    expect(t.label).toBe("estável");
  });

  it("símbolos de direção", () => {
    expect(directionSymbol("up")).toBe("↑");
    expect(directionSymbol("down")).toBe("↓");
    expect(directionSymbol("flat")).toBe("→");
    expect(directionSymbol("unknown")).toBe("—");
  });
});

describe("accounting-ai · datas", () => {
  it("dia anterior atravessa o mês", () => {
    expect(previousDayISO("2026-03-01")).toBe("2026-02-28");
    expect(previousDayISO("2026-01-01")).toBe("2025-12-31");
  });

  it("mês anterior atravessa o ano", () => {
    expect(previousMonthPeriod({ start: "2026-01-01", end: "2026-01-31" })).toMatchObject({
      start: "2025-12-01",
      end: "2025-12-31",
    });
  });

  it("dayPeriod e todayISO", () => {
    expect(dayPeriod("2026-05-10")).toEqual({
      start: "2026-05-10",
      end: "2026-05-10",
      label: "2026-05-10",
    });
    expect(todayISO(new Date(2026, 4, 3))).toBe("2026-05-03");
  });
});

describe("accounting-ai · health label", () => {
  it("Excelente quando saudável sem ressalvas", () => {
    expect(healthLabel({ level: "healthy", reasons: [] })).toBe("Excelente");
  });
  it("Boa quando saudável com ressalvas", () => {
    expect(healthLabel({ level: "healthy", reasons: ["x"] })).toBe("Boa");
  });
  it("Atenção e Crítica", () => {
    expect(healthLabel({ level: "attention", reasons: [] })).toBe("Atenção");
    expect(healthLabel({ level: "critical", reasons: [] })).toBe("Crítica");
    expect(healthLabel({ level: "unknown", reasons: [] })).toBe("Sem dados");
  });
});

describe("accounting-ai · consultas", () => {
  it("responde as 14 consultas com dados reais do summary", async () => {
    const s = await makeSummary();
    const answers = runAllAccountingQueries(s);
    expect(answers).toHaveLength(14);
    expect(answers.every((a) => a.available)).toBe(true);
  });

  it("receita hoje vem do provider de vendas", async () => {
    const s = await makeSummary();
    expect(accountingQueries.receitaHoje(s).value).toBe(800);
  });

  it("lucro bruto e líquido vêm do DRE", async () => {
    const s = await makeSummary();
    expect(accountingQueries.lucroBruto(s).value).toBe(7000);
    expect(accountingQueries.lucroLiquido(s).value).toBe(3000);
  });

  it("produto mais e menos vendido", async () => {
    const s = await makeSummary();
    expect(accountingQueries.produtoMaisVendido(s).text).toContain("Produto A");
    expect(accountingQueries.produtoMenosVendido(s).text).toContain("Produto Y");
  });

  it("clientes por compras e por faturamento", async () => {
    const s = await makeSummary();
    expect(accountingQueries.clienteQueMaisCompra(s).text).toContain("Cliente B");
    expect(accountingQueries.clienteMaiorFaturamento(s).text).toContain("Cliente A");
  });

  it("degrada a consulta quando o provider falhou", async () => {
    const s = await makeSummary({ breakFinance: true });
    const caixa = accountingQueries.caixaDisponivel(s);
    expect(caixa.available).toBe(false);
    expect(caixa.text).toContain("sem dados");
    // demais consultas continuam respondendo
    expect(accountingQueries.receitaMes(s).available).toBe(true);
  });
});

describe("accounting-ai · resumo executivo", () => {
  it("saudação depende do horário", () => {
    expect(greetingFor(new Date(2026, 0, 1, 9))).toBe("Bom dia.");
    expect(greetingFor(new Date(2026, 0, 1, 14))).toBe("Boa tarde.");
    expect(greetingFor(new Date(2026, 0, 1, 21))).toBe("Boa noite.");
  });

  it("monta frases apenas com dados reais", async () => {
    const s = await makeSummary();
    const brief = buildExecutiveBrief(s);
    expect(brief.empty).toBe(false);
    expect(brief.lines.join(" ")).toContain("em caixa");
    expect(brief.lines.join(" ")).toContain("ticket médio");
    expect(brief.lines.join(" ")).toContain("Produto A");
  });

  it("sem summary não inventa nada", () => {
    const brief = buildExecutiveBrief(undefined);
    expect(brief.empty).toBe(true);
    expect(brief.lines).toHaveLength(0);
  });

  it("omite caixa quando o financeiro falha", async () => {
    const s = await makeSummary({ breakFinance: true });
    const brief = buildExecutiveBrief(s);
    expect(brief.lines.join(" ")).not.toContain("em caixa");
    expect(brief.empty).toBe(false);
  });
});
