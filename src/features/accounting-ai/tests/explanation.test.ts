/**
 * Sprint 7.3 — Bella Explica.
 *
 * Todos os números usados aqui vêm das portas oficiais (fakes com o mesmo
 * shape). Nenhum teste escreve fórmula financeira: apenas confere que a
 * explicação cita exatamente o que os motores apuraram.
 */
import { describe, expect, it } from "vitest";
import {
  buildExplanation,
  buildExplanationSnapshot,
  buildImpactRanking,
  describeExplanation,
  describeImpactRanking,
  describeIndicators,
  explanationProvider,
  NO_EVIDENCE,
  type ExplanationDataset,
  type ExplanationPeriodFacts,
} from "../explanation";
import { buildBellaNotifications } from "../proactive";
import { askBella } from "../chat";
import { detectIntent } from "../chat/intent-engine";
import { planIntent } from "../chat/planner";
import { getAccountingSkill } from "../skills";
import { makeSummary, makeTestServices, testPeriod, testToday } from "./fixtures";

const previousPeriod = { start: "2025-12-01", end: "2025-12-31", label: "12/2025" };

function facts(patch: Partial<ExplanationPeriodFacts> = {}): ExplanationPeriodFacts {
  return {
    period: testPeriod,
    grossRevenue: 12000,
    deductions: 1000,
    netRevenue: 11000,
    cogs: 4000,
    operatingExpenses: 3000,
    financialExpenses: 500,
    otherExpenses: 200,
    grossProfit: 7000,
    operatingResult: 4000,
    netProfit: 3000,
    grossMargin: 63.6,
    netMargin: 27.3,
    cogsRatio: 36,
    expenseRatio: 27,
    averageTicket: 250,
    salesCount: 44,
    paidTotal: 11000,
    customersActive: 20,
    customersNew: 5,
    customersRecurring: 8,
    ...patch,
  };
}

async function makeDataset(
  patch: Partial<ExplanationDataset> = {},
): Promise<ExplanationDataset> {
  const summary = await makeSummary();
  return {
    period: testPeriod,
    previousPeriod,
    current: facts(),
    previous: facts({
      period: previousPeriod,
      netRevenue: 12000,
      cogs: 3600,
      operatingExpenses: 2800,
      financialExpenses: 260,
      netProfit: 4000,
      netMargin: 33.3,
      cogsRatio: 30,
      expenseRatio: 23,
      averageTicket: 300,
      salesCount: 40,
      customersActive: 24,
      customersNew: 7,
      customersRecurring: 10,
    }),
    summary,
    tax: null,
    audit: null,
    ...patch,
  };
}

describe("Bella Explica · lucro", () => {
  it("explica a queda do lucro com causas ordenadas por impacto", async () => {
    const explanation = buildExplanation("lucro", await makeDataset());
    expect(explanation.available).toBe(true);
    expect(explanation.causes.length).toBeLessThanOrEqual(3);
    expect(explanation.causes.length).toBeGreaterThan(0);
    // ordenado do maior para o menor impacto
    const weights = explanation.causes.map((c) => c.weight);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
    expect(explanation.biggestImpact?.id).toBe("receita");
    expect(explanation.recommendation).toBeTruthy();
  });

  it("cita apenas números presentes no dataset oficial", async () => {
    const dataset = await makeDataset();
    const explanation = buildExplanation("lucro", dataset);
    const receita = explanation.causes.find((c) => c.id === "receita");
    expect(receita?.current).toBe(dataset.current?.netRevenue);
    expect(receita?.previous).toBe(dataset.previous?.netRevenue);
    expect(receita?.impact).toBe(
      (dataset.current?.netRevenue ?? 0) - (dataset.previous?.netRevenue ?? 0),
    );
  });

  it("responde sem evidência quando falta o período anterior", async () => {
    const explanation = buildExplanation("lucro", await makeDataset({ previous: null }));
    expect(explanation.available).toBe(false);
    expect(explanation.summary).toBe(NO_EVIDENCE);
    expect(describeExplanation(explanation)).toBe(NO_EVIDENCE);
  });
});

describe("Bella Explica · demais temas", () => {
  it("explica receita, margem, CMV, despesas, ticket e clientes", async () => {
    const dataset = await makeDataset();
    for (const topic of ["receita", "margem", "cmv", "despesas", "ticket", "clientes"] as const) {
      const explanation = buildExplanation(topic, dataset);
      expect(explanation.available).toBe(true);
      expect(explanation.causes.length).toBeGreaterThan(0);
      expect(explanation.evidence.length).toBeGreaterThan(0);
    }
  });

  it("explica caixa e estoque a partir do resumo oficial", async () => {
    const dataset = await makeDataset();
    const caixa = buildExplanation("caixa", dataset);
    const estoque = buildExplanation("estoque", dataset);
    expect(caixa.available).toBe(true);
    expect(caixa.evidence.some((e) => e.label === "Saldo atual")).toBe(true);
    expect(estoque.available).toBe(true);
  });

  it("explica impostos usando o retrato tributário oficial", async () => {
    const dataset = await makeDataset({
      tax: {
        competence: "2026-01",
        regime: "simples_nacional",
        annex: "I",
        rbt12: 1_200_000,
        monthRevenue: 11000,
        bracket: 3,
        nominalRate: 10.7,
        deduction: 22500,
        effectiveRate: 8.83,
        dasAmount: 971,
        dasSource: "simulacao",
        dasStatus: null,
        dueDate: "2026-02-20",
        dueDay: 20,
        limitUsagePct: 25,
        bracketCeiling: 1_800_000,
        distanceToNextBracket: 600_000,
        alerts: [],
        history: [
          { competence: "2025-12", taxAmount: 800, revenue: 9000, effectiveRate: 8.5, bracket: 2, status: "paid" },
        ],
        averageTax: 800,
      },
    });
    const impostos = buildExplanation("impostos", dataset);
    expect(impostos.available).toBe(true);
    expect(impostos.causes.some((c) => c.id === "receita_tributavel")).toBe(true);
    expect(impostos.evidence.some((e) => e.label === "RBT12")).toBe(true);
  });

  it("explica pró-labore a partir do advisor oficial", async () => {
    const explanation = buildExplanation("prolabore", await makeDataset());
    expect(explanation.available).toBe(true);
  });

  it("sem resumo, temas dependentes respondem sem evidência", async () => {
    const dataset = await makeDataset({ summary: null, tax: null });
    for (const topic of ["caixa", "fluxo_caixa", "estoque", "impostos", "prolabore"] as const) {
      expect(buildExplanation(topic, dataset).available).toBe(false);
      expect(buildExplanation(topic, dataset).summary).toBe(NO_EVIDENCE);
    }
  });
});

describe("Bella Explica · ranking e formato", () => {
  it("rankeia no máximo 3 impactos monetários", async () => {
    const ranking = buildImpactRanking(await makeDataset());
    expect(ranking.length).toBeLessThanOrEqual(3);
    expect(ranking.length).toBeGreaterThan(0);
    const weights = ranking.map((c) => c.weight);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });

  it("o texto segue Resumo → causas → dados → recomendação", async () => {
    const snapshot = buildExplanationSnapshot(await makeDataset());
    const text = describeExplanation(snapshot.explanations.lucro);
    expect(text).toContain("Principais causas:");
    expect(text).toContain("Dados:");
    expect(text).toContain("Recomendação:");
    expect(text.indexOf("Principais causas:")).toBeLessThan(text.indexOf("Dados:"));
    expect(text.indexOf("Dados:")).toBeLessThan(text.indexOf("Recomendação:"));
  });

  it("ranking e indicadores degradam sem dados", () => {
    expect(describeImpactRanking(null)).toBe(NO_EVIDENCE);
    expect(describeIndicators(null)).toBe(NO_EVIDENCE);
  });
});

describe("Bella Explica · provider e skills", () => {
  it("o provider lê período atual e anterior pelas portas oficiais", async () => {
    const res = await explanationProvider("c1", {
      services: makeTestServices(),
      period: testPeriod,
      today: testToday,
      summary: await makeSummary(),
    });
    expect(res.available).toBe(true);
    expect(res.data?.explanations.lucro.available).toBe(true);
    expect(res.data?.previousPeriod).not.toBeNull();
  });

  it("sem histórico, o provider entrega explicação sem evidência", async () => {
    const res = await explanationProvider("c1", {
      services: makeTestServices({ noHistory: true }),
      period: testPeriod,
      today: testToday,
      summary: await makeSummary({ noHistory: true }),
    });
    expect(res.available).toBe(true);
    expect(res.data?.explanations.lucro.available).toBe(false);
    expect(res.data?.explanations.lucro.summary).toBe(NO_EVIDENCE);
  });

  it("as skills de explicação existem e são somente leitura", () => {
    const ids = [
      "explicar_lucro",
      "explicar_caixa",
      "explicar_receita",
      "explicar_despesas",
      "explicar_impostos",
      "explicar_ticket",
      "explicar_estoque",
      "explicar_resultado",
      "explicar_indicadores",
    ] as const;
    for (const id of ids) {
      const skill = getAccountingSkill(id);
      expect(skill).toBeDefined();
      expect(skill?.readOnly).toBe(true);
    }
  });
});

describe("Bella Explica · chat", () => {
  const questions: Array<[string, string]> = [
    ["Por que meu lucro caiu?", "explicar_lucro"],
    ["Por que meu caixa caiu?", "explicar_caixa"],
    ["Por que vendi menos?", "explicar_receita"],
    ["Por que minhas despesas subiram?", "explicar_despesas"],
    ["Por que meu DAS aumentou?", "explicar_impostos"],
    ["Por que meu ticket caiu?", "explicar_ticket"],
    ["Por que meu estoque está assim?", "explicar_estoque"],
    ["Qual foi o maior impacto este mês?", "explicar_resultado"],
    ["Explique meus indicadores", "explicar_indicadores"],
  ];

  it.each(questions)("reconhece a intenção de %s", (question, intent) => {
    const match = detectIntent(question);
    expect(match.intent).toBe(intent);
    expect(planIntent(match).steps[0]?.skillId).toBe(intent);
  });

  it("responde com causas e recomendação usando dados oficiais", async () => {
    const answer = await askBella("Por que meu lucro caiu?", "c1", {
      deps: {
        services: makeTestServices(),
        period: testPeriod,
        today: testToday,
      },
    });
    expect(answer.intent).toBe("explicar_lucro");
    expect(answer.answered).toBe(true);
    expect(answer.text).toContain("Principais causas:");
    expect(answer.text).toContain("Recomendação:");
  });

  it("sem evidência, a Bella nunca inventa uma explicação", async () => {
    const answer = await askBella("Por que meu lucro caiu?", "c1", {
      deps: {
        services: makeTestServices({ noHistory: true }),
        period: testPeriod,
        today: testToday,
      },
    });
    expect(answer.answered).toBe(false);
    expect(answer.text).toContain("Não encontrei dados suficientes");
  });
});

describe("Bella Explica · proativa", () => {
  it("gera as notificações derivadas das explicações", async () => {
    const dataset = await makeDataset();
    const snapshot = buildExplanationSnapshot(dataset);
    const summary = dataset.summary!;
    const notifications = buildBellaNotifications(
      { summary, explanation: snapshot },
      { now: "2026-01-20T12:00:00.000Z", limit: undefined },
    );
    const ids = notifications.map((n) => n.id);
    expect(ids).toContain("motivo_queda_lucro");
    expect(ids).toContain("maior_despesa");
  });

  it("sem explicações, nenhuma notificação da Sprint 7.3 aparece", async () => {
    const summary = await makeSummary();
    const ids = buildBellaNotifications({ summary }, { now: "2026-01-20T12:00:00.000Z", limit: undefined }).map(
      (n) => n.id,
    );
    for (const id of ["motivo_queda_lucro", "maior_crescimento_mes", "maior_despesa", "maior_economia"]) {
      expect(ids).not.toContain(id);
    }
  });
});
