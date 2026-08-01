/**
 * Sprint 7.4 — Hardening & UX (READ-ONLY).
 *
 * Cobre padronização de formato, rastreabilidade interna, confiança,
 * telemetria, cache e fallback. Nenhum teste aqui valida regra de negócio:
 * todos verificam qualidade de resposta e observabilidade.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { askBella } from "../chat";
import {
  FALLBACK_LOW_CONFIDENCE,
  FALLBACK_NO_DATA,
  FALLBACK_UNKNOWN,
  buildAnswer,
} from "../chat/response-builder";
import {
  MIN_ANSWER_CONFIDENCE,
  answerConfidence,
  buildTrace,
  usedKpis,
  usedProviders,
  usedSnapshots,
} from "../chat/trace";
import { planIntent } from "../chat/planner";
import { detectIntent } from "../chat/intent-engine";
import {
  BELLA_SECTION_ORDER,
  collapse,
  dedupeSentences,
  evidenceList,
  formatSections,
  limitEmoji,
  numbered,
  polish,
} from "../lib/response-format";
import { bellaTelemetry, sanitizeLabel } from "../telemetry";
import { createBellaContext } from "../context/bella-context";
import { makeSummary, makeTestServices, testPeriod, testToday } from "./fixtures";

const deps = () => ({
  services: makeTestServices(),
  period: testPeriod,
  today: testToday,
});

beforeEach(() => {
  bellaTelemetry.reset();
});

describe("7.4 · formatação padronizada", () => {
  it("respeita a ordem canônica dos blocos", () => {
    const text = formatSections({
      summary: "Resumo do período.",
      explanation: "1. Receita caiu. 2. CMV subiu.",
      evidence: "Receita: R$ 10,00 · CMV: R$ 4,00",
      recommendation: "Revisar fornecedores.",
    });
    expect(text.startsWith("Resumo do período.")).toBe(true);
    expect(text.indexOf("Explicação:")).toBeLessThan(text.indexOf("Evidências:"));
    expect(text.indexOf("Evidências:")).toBeLessThan(text.indexOf("Recomendação:"));
    expect(BELLA_SECTION_ORDER).toEqual([
      "summary",
      "explanation",
      "evidence",
      "recommendation",
    ]);
  });

  it("omite blocos vazios sem deixar rótulo órfão", () => {
    const text = formatSections({ summary: "Só o resumo.", evidence: "   " });
    expect(text).toBe("Só o resumo.");
    expect(text).not.toContain("Evidências:");
  });

  it("normaliza espaços, pontuação duplicada e repetições", () => {
    expect(collapse("Receita   subiu  .")).toBe("Receita subiu.");
    expect(dedupeSentences("Caixa caiu. Caixa caiu. Lucro subiu.")).toBe(
      "Caixa caiu. Lucro subiu.",
    );
    expect(polish("Caixa caiu!!  Caixa caiu!!")).toBe("Caixa caiu!");
  });

  it("limita emojis a um por resposta", () => {
    expect(limitEmoji("📉 queda 📉 forte 📉")).toBe("📉 queda forte");
    expect(limitEmoji("📉 queda 📉", 0)).toBe("queda");
  });

  it("numeração e evidências seguem o mesmo padrão", () => {
    expect(numbered(["Receita caiu", "CMV subiu"])).toBe("1. Receita caiu 2. CMV subiu");
    expect(evidenceList([{ label: "Receita", value: "R$ 10" }, { label: "CMV", value: "R$ 4" }])).toBe(
      "Receita: R$ 10 · CMV: R$ 4",
    );
  });

  it("as respostas do chat saem sem espaços duplos nem repetição", async () => {
    const answer = await askBella("Como está minha receita?", "c1", { deps: deps() });
    expect(answer.text).toBe(collapse(answer.text));
    expect(answer.text).not.toMatch(/\s{2,}/);
  });
});

describe("7.4 · rastreabilidade interna", () => {
  it("registra snapshots, providers, KPIs e skills sem expor ao usuário", async () => {
    const answer = await askBella("Como está minha receita?", "c1", { deps: deps() });
    expect(answer.trace).toBeDefined();
    expect(answer.trace?.snapshots).toContain("AccountingSummary");
    expect(answer.trace?.providers.length).toBeGreaterThan(0);
    expect(answer.trace?.skills.length).toBeGreaterThan(0);
    // nada da rastreabilidade aparece no texto
    for (const provider of answer.trace!.providers) {
      expect(answer.text.includes(`providers:${provider}`)).toBe(false);
    }
    expect(answer.text).not.toContain("snapshots");
    expect(answer.text).not.toContain("trace");
  });

  it("marca o retrato tributário quando a pergunta é fiscal", async () => {
    const answer = await askBella("Quanto vou pagar de DAS?", "c1", { deps: deps() });
    expect(answer.trace?.snapshots).toContain("TaxSnapshot");
  });

  it("marca o retrato de explicações nas perguntas 'por quê'", async () => {
    const answer = await askBella("Por que meu lucro caiu?", "c1", { deps: deps() });
    expect(answer.trace?.snapshots).toContain("ExplanationSnapshot");
  });

  it("os seletores de rastreabilidade são puros e tolerantes a vazio", async () => {
    expect(usedSnapshots(null)).toEqual([]);
    expect(usedProviders(null)).toEqual([]);
    expect(usedKpis([])).toEqual([]);
    const summary = await makeSummary();
    expect(usedProviders({ summary })).toContain("revenue");
    expect(usedProviders({ summary })).not.toContain("companyId");
    expect(
      usedKpis([
        { skillId: "consultar_receita", ok: true, text: "x", data: { total: 10, label: "a" } },
      ]),
    ).toEqual(["label", "total"]);
  });
});

describe("7.4 · confiança", () => {
  it("confiança combina intenção e evidência disponível", () => {
    expect(answerConfidence(1, 0, 3)).toBe(0);
    expect(answerConfidence(1, 3, 3)).toBe(1);
    expect(answerConfidence(0.6, 1, 8)).toBeLessThan(MIN_ANSWER_CONFIDENCE);
  });

  it("baixa confiança responde a frase padrão e nunca completa dados", () => {
    const plan = planIntent(detectIntent("Como está minha receita?"));
    const outcomes = [
      {
        skillId: plan.steps[0]!.skillId,
        ok: true,
        text: "Receita de R$ 10,00.",
        data: null,
      },
    ];
    const trace = buildTrace({
      plan,
      outcomes,
      intentConfidence: 0.1,
      deps: null,
    });
    expect(trace.lowConfidence).toBe(true);
    const answer = buildAnswer(plan, outcomes, { trace });
    expect(answer.answered).toBe(false);
    expect(answer.text).toBe("Não encontrei dados suficientes para responder com segurança.");
    expect(answer.text).toBe(FALLBACK_LOW_CONFIDENCE);
    expect(answer.text).not.toContain("R$");
  });

  it("respostas com evidência completa mantêm alta confiança", async () => {
    const answer = await askBella("Como está minha receita?", "c1", { deps: deps() });
    expect(answer.answered).toBe(true);
    expect(answer.trace?.lowConfidence).toBe(false);
    expect(answer.trace?.confidence).toBeGreaterThanOrEqual(MIN_ANSWER_CONFIDENCE);
  });

  it("fallbacks continuam distintos e sem invenção", async () => {
    const unknown = await askBella("qual a cor do céu?", "c1", { deps: deps() });
    expect(unknown.text).toBe(FALLBACK_UNKNOWN);
    expect(unknown.answered).toBe(false);
    expect(FALLBACK_NO_DATA).toBe(FALLBACK_LOW_CONFIDENCE);
  });
});

describe("7.4 · telemetria e performance", () => {
  it("mede tempo de resposta e providers de cada pergunta", async () => {
    await askBella("Como está minha receita?", "c1", { deps: deps() });
    const chat = bellaTelemetry.metricsFor("chat");
    expect(chat?.count).toBe(1);
    expect(chat?.averageMs).toBeGreaterThanOrEqual(0);
    expect(chat?.providers).toBeGreaterThan(0);
  });

  it("conta cache miss na primeira leitura e cache hit na reutilização", async () => {
    const base = deps();
    await askBella("Como está minha receita?", "c1", { deps: base });
    expect(bellaTelemetry.metricsFor("summary")?.cacheMisses).toBe(1);

    const summary = await makeSummary();
    bellaTelemetry.reset();
    await askBella("Como está minha receita?", "c1", { deps: { ...base, summary } });
    const metrics = bellaTelemetry.metricsFor("summary");
    expect(metrics?.cacheHits).toBe(1);
    expect(metrics?.cacheMisses).toBe(0);
    expect(metrics?.cacheHitRate).toBe(1);
  });

  it("o BellaContext lê cada retrato uma vez e registra hit nas releituras", async () => {
    const ctx = createBellaContext({
      companyId: "c1",
      period: testPeriod,
      today: testToday,
      services: makeTestServices(),
    });
    await ctx.snapshots();
    await ctx.snapshots();
    expect(ctx.stats).toEqual({ summary: 1, tax: 1, audit: 1 });
    const summary = bellaTelemetry.metricsFor("summary");
    expect(summary?.cacheMisses).toBe(1);
    expect(summary?.cacheHits).toBe(1);
    expect(bellaTelemetry.metricsFor("dashboard")?.count).toBe(2);
  });

  it("o snapshot agrega média, máximo e taxa de cache", () => {
    bellaTelemetry.record({ kind: "summary", label: "summary", durationMs: 10, cache: "miss" });
    bellaTelemetry.record({ kind: "summary", label: "summary", durationMs: 0, cache: "hit" });
    const snapshot = bellaTelemetry.snapshot();
    expect(snapshot.totalEvents).toBe(2);
    expect(snapshot.averageMs).toBe(5);
    expect(snapshot.cacheHitRate).toBe(0.5);
    expect(snapshot.byKind[0]?.maxMs).toBe(10);
  });

  it("nunca registra dados sensíveis no rótulo", () => {
    bellaTelemetry.record({
      kind: "chat",
      label: "Receita R$ 12.345,67 do cliente João",
      durationMs: 1,
    });
    const event = bellaTelemetry.list("chat")[0]!;
    expect(event.label).not.toMatch(/\d/);
    expect(event.label).not.toContain("$");
    expect(sanitizeLabel("DAS 2026 R$ 900")).toBe("das_r");
  });

  it("erros são medidos sem serem engolidos", async () => {
    await expect(
      bellaTelemetry.measure({ kind: "audit", label: "falha" }, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(bellaTelemetry.metricsFor("audit")?.failures).toBe(1);
  });

  it("a telemetria pode ser desligada sem afetar as respostas", async () => {
    bellaTelemetry.setEnabled(false);
    const answer = await askBella("Como está minha receita?", "c1", { deps: deps() });
    expect(answer.answered).toBe(true);
    expect(bellaTelemetry.snapshot().totalEvents).toBe(0);
    bellaTelemetry.setEnabled(true);
  });
});
