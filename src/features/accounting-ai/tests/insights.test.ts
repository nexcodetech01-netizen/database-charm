import { describe, expect, it } from "vitest";
import {
  CATEGORY_ORDER,
  INSUFFICIENT_HISTORY,
  SEVERITY_ORDER,
  buildAccountingAlerts,
  buildAccountingInsightGroups,
  buildAccountingInsights,
  buildAccountingRecommendations,
  cashCoverageDays,
  categoryLabel,
  computePriority,
  filterAlerts,
  formatPercent,
  groupInsights,
  magnitudeScore,
  severityLabel,
  severityRank,
  sortInsights,
  trendOf,
  type AccountingInsight,
} from "../insights";
import { getAccountingSkill } from "../skills";
import { makeSummary, makeTestServices, testPeriod, testToday } from "./fixtures";
import type { AccountingSummary } from "../types";

const NOW = new Date("2026-01-20T12:00:00.000Z");

function insight(over: Partial<AccountingInsight>): AccountingInsight {
  return {
    id: "x",
    severity: "info",
    category: "receita",
    title: "t",
    description: "d",
    recommendation: "r",
    priority: 10,
    action: { id: "acompanhar", label: "Acompanhar" },
    sourceProvider: "revenue",
    createdAt: NOW.toISOString(),
    ...over,
  };
}

describe("insights · helpers puros", () => {
  it("severityRank respeita critical → warning → success → info", () => {
    expect(SEVERITY_ORDER).toEqual(["critical", "warning", "success", "info"]);
    expect(severityRank("critical")).toBeLessThan(severityRank("warning"));
    expect(severityRank("warning")).toBeLessThan(severityRank("success"));
    expect(severityRank("success")).toBeLessThan(severityRank("info"));
  });

  it("magnitudeScore fica entre 0 e 10 e satura em 50%", () => {
    expect(magnitudeScore(null)).toBe(0);
    expect(magnitudeScore(undefined)).toBe(0);
    expect(magnitudeScore(Number.NaN)).toBe(0);
    expect(magnitudeScore(0)).toBe(0);
    expect(magnitudeScore(-25)).toBe(5);
    expect(magnitudeScore(50)).toBe(10);
    expect(magnitudeScore(500)).toBe(10);
  });

  it("computePriority soma base da severidade com magnitude e limita a 100", () => {
    expect(computePriority("info")).toBe(20);
    expect(computePriority("success", 10)).toBe(42);
    expect(computePriority("warning", -50)).toBe(80);
    expect(computePriority("critical", 200)).toBe(100);
  });

  it("trendOf delega para a comparação existente", () => {
    expect(trendOf(100, null).hasHistory).toBe(false);
    expect(trendOf(110, 100).direction).toBe("up");
    expect(trendOf(90, 100).direction).toBe("down");
    expect(trendOf(100, 100).direction).toBe("flat");
  });

  it("sortInsights ordena por severidade, prioridade e id", () => {
    const list = [
      insight({ id: "b", severity: "info", priority: 20 }),
      insight({ id: "a", severity: "critical", priority: 90 }),
      insight({ id: "c", severity: "warning", priority: 70 }),
      insight({ id: "d", severity: "warning", priority: 75 }),
      insight({ id: "e", severity: "success", priority: 40 }),
    ];
    expect(sortInsights(list).map((i) => i.id)).toEqual(["a", "d", "c", "e", "b"]);
    // não muta o original
    expect(list[0]?.id).toBe("b");
  });

  it("groupInsights agrupa na ordem oficial e omite vazios", () => {
    const groups = groupInsights([
      insight({ id: "1", category: "clientes" }),
      insight({ id: "2", category: "receita" }),
      insight({ id: "3", category: "clientes" }),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["receita", "clientes"]);
    expect(groups[1]?.insights).toHaveLength(2);
    expect(CATEGORY_ORDER).toHaveLength(8);
  });

  it("filterAlerts mantém apenas critical e warning", () => {
    const alerts = filterAlerts([
      insight({ id: "1", severity: "info" }),
      insight({ id: "2", severity: "warning", priority: 70 }),
      insight({ id: "3", severity: "critical", priority: 90 }),
      insight({ id: "4", severity: "success" }),
    ]);
    expect(alerts.map((i) => i.id)).toEqual(["3", "2"]);
  });

  it("formatPercent, categoryLabel e severityLabel são determinísticos", () => {
    expect(formatPercent(-14.04)).toBe("14,0%");
    expect(categoryLabel("fiscal")).toBe("Fiscal");
    expect(severityLabel("critical")).toBe("Crítico");
  });

  it("cashCoverageDays retorna null sem despesas apuradas", () => {
    expect(cashCoverageDays(5000, 0)).toBeNull();
    expect(cashCoverageDays(5000, 3000, 0)).toBeNull();
    expect(cashCoverageDays(3000, 3000, 30)).toBe(30);
    expect(cashCoverageDays(1500, 3000, 30)).toBe(15);
  });
});

describe("insights · engine", () => {
  it("retorna vazio sem summary", () => {
    expect(buildAccountingInsights(undefined)).toEqual([]);
    expect(buildAccountingInsights(null)).toEqual([]);
  });

  it("gera insights ordenados a partir de dados reais dos providers", async () => {
    const summary = await makeSummary();
    const insights = buildAccountingInsights(summary, { now: NOW });

    expect(insights.length).toBeGreaterThan(0);
    // ordenação global por severidade
    const ranks = insights.map((i) => severityRank(i.severity));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);

    // todo insight é completo e acionável
    for (const i of insights) {
      expect(i.id).toBeTruthy();
      expect(i.title).toBeTruthy();
      expect(i.description).toBeTruthy();
      expect(i.recommendation).toBeTruthy();
      expect(i.action.label).toBeTruthy();
      expect(i.priority).toBeGreaterThanOrEqual(0);
      expect(i.priority).toBeLessThanOrEqual(100);
      expect(i.createdAt).toBe(NOW.toISOString());
      expect(CATEGORY_ORDER).toContain(i.category);
    }

    // ids únicos
    expect(new Set(insights.map((i) => i.id)).size).toBe(insights.length);
  });

  it("identifica receita em crescimento e produto campeão", async () => {
    const summary = await makeSummary();
    const insights = buildAccountingInsights(summary, { now: NOW });
    const ids = insights.map((i) => i.id);
    expect(ids).toContain("receita_aumentou");
    expect(ids).toContain("produto_campeao");
    const champion = insights.find((i) => i.id === "produto_campeao");
    expect(champion?.description).toContain("Produto A");
    expect(champion?.action.id).toBe("comprar_estoque");
  });

  it("informa 'Histórico insuficiente.' quando não há comparação", async () => {
    const summary = await makeSummary({ noHistory: true });
    const insights = buildAccountingInsights(summary, { now: NOW });
    const semHistorico = insights.filter((i) => i.description.includes(INSUFFICIENT_HISTORY));
    expect(semHistorico.length).toBeGreaterThan(0);
    expect(semHistorico.every((i) => i.severity === "info")).toBe(true);
    // nunca inventa número quando falta base
    expect(insights.map((i) => i.id)).toContain("ticket_sem_historico");
  });

  it("usa o ticket anterior quando informado", async () => {
    const summary = await makeSummary();
    const up = buildAccountingInsights(summary, { now: NOW, previousAverageTicket: 100 });
    expect(up.map((i) => i.id)).toContain("ticket_subindo");
    const down = buildAccountingInsights(summary, { now: NOW, previousAverageTicket: 400 });
    expect(down.map((i) => i.id)).toContain("ticket_caindo");
  });

  it("degrada com falha parcial de provider (financeiro indisponível)", async () => {
    const summary = await makeSummary({ breakFinance: true });
    const insights = buildAccountingInsights(summary, { now: NOW });
    expect(insights.every((i) => i.category !== "caixa")).toBe(true);
    expect(insights.every((i) => i.category !== "financeiro")).toBe(true);
    // demais categorias continuam funcionando
    expect(insights.map((i) => i.category)).toContain("produtos");
  });

  it("classifica caixa crítico e cobrança quando o saldo é negativo", async () => {
    const services = makeTestServices();
    const base = services.finance.snapshot;
    services.finance.snapshot = async (...args: Parameters<typeof base>) => {
      const snap = await base(...args);
      return {
        ...snap,
        overview: { ...snap.overview, currentBalance: -2000 },
      };
    };
    const summary = await buildSummaryWith(services);
    const insights = buildAccountingInsights(summary, { now: NOW });
    const caixa = insights.find((i) => i.category === "caixa");
    expect(caixa?.id).toBe("caixa_negativo");
    expect(caixa?.severity).toBe("critical");
    expect(caixa?.action.id).toBe("cobrar_cliente");
    expect(insights[0]?.severity).toBe("critical");
  });

  it("alertas contêm apenas critical/warning e recomendações preservam a ordem", async () => {
    const summary = await makeSummary();
    const insights = buildAccountingInsights(summary, { now: NOW });
    const alerts = buildAccountingAlerts(summary, { now: NOW });
    expect(alerts.every((a) => a.severity === "critical" || a.severity === "warning")).toBe(true);
    expect(alerts.length).toBeLessThanOrEqual(insights.length);

    const recs = buildAccountingRecommendations(summary, { now: NOW });
    expect(recs.map((r) => r.id)).toEqual(insights.map((i) => i.id));
    expect(recs.every((r) => r.recommendation.length > 0)).toBe(true);
  });

  it("agrupa por categoria", async () => {
    const summary = await makeSummary();
    const groups = buildAccountingInsightGroups(summary, { now: NOW });
    expect(groups.length).toBeGreaterThan(0);
    const order = groups.map((g) => CATEGORY_ORDER.indexOf(g.category));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

async function buildSummaryWith(services: ReturnType<typeof makeTestServices>) {
  const { buildAccountingSummary } = await import("../providers/summary");
  return buildAccountingSummary("c1", {
    services,
    period: testPeriod,
    today: testToday,
  }) as Promise<AccountingSummary>;
}

describe("insights · skills", () => {
  const deps = { services: makeTestServices(), period: testPeriod, today: testToday };

  it("consultar_insights responde com dados reais", async () => {
    const res = await getAccountingSkill("consultar_insights")!.run("c1", deps);
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    expect((res.data as AccountingInsight[]).length).toBeGreaterThan(0);
    expect(res.text.length).toBeGreaterThan(0);
  });

  it("consultar_alertas devolve somente alertas", async () => {
    const res = await getAccountingSkill("consultar_alertas")!.run("c1", deps);
    const data = res.data as AccountingInsight[];
    expect(res.ok).toBe(true);
    expect(data.every((a) => a.severity === "critical" || a.severity === "warning")).toBe(true);
  });

  it("consultar_recomendacoes devolve ações sugeridas", async () => {
    const res = await getAccountingSkill("consultar_recomendacoes")!.run("c1", deps);
    expect(res.ok).toBe(true);
    const data = res.data as { action: { label: string }; recommendation: string }[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.action.label && r.recommendation)).toBe(true);
  });

  it("as três skills são somente leitura", () => {
    for (const id of ["consultar_insights", "consultar_alertas", "consultar_recomendacoes"] as const) {
      expect(getAccountingSkill(id)?.readOnly).toBe(true);
    }
  });
});
