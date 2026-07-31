import { describe, expect, it, vi } from "vitest";
import {
  createCommercialTools,
  createIntentRouter,
  createOrchestrator,
  createToolRegistry,
  type AIInteractionEvent,
  type ToolExecutors,
} from "../ai";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures mínimos (mesma forma dos DTOs reais do Pricing).
// ─────────────────────────────────────────────────────────────────────────────

const dashboardFixture = {
  health: { level: "very_good", stars: 4, label: "Muito bom", summary: "" },
  kpis: {
    productsTotal: 42,
    productsWithOwnPolicy: 10,
    productsInheritingPolicy: 32,
    productsBelowMargin: 3,
    productsWithoutCost: 1,
    productsWithoutPrice: 0,
    productsWithSuggestion: 7,
    lastUpdatedAt: "2026-07-14T12:00:00.000Z",
  },
  opportunities: [
    {
      kind: "increase_profit",
      count: 7,
      title: "Aumentar margem em 7 produtos",
      description: "",
      actionLabel: "Ver produtos",
      actionHref: "/inteligencia-comercial/dashboard",
    },
  ],
  priorityProducts: [],
  categorySummaries: [],
  recentDecisions: [],
  insights: [],
};

const companyFixture = {
  policy: {
    entity: { minMarginPct: 15, idealMarginPct: 30, premiumMarginPct: 45 },
    version: 3,
  },
  stats: { categoriesUsingPolicy: 5, productsOverriding: 12 },
};

const categoryFixture = {
  companyPolicy: companyFixture.policy,
  rows: [
    { category: { id: "c1", name: "Bolsas" }, policy: { entity: {} } },
    { category: { id: "c2", name: "Cintos" }, policy: null },
  ],
};

const productExplainFixture = {
  product: {
    id: "p1",
    name: "Bolsa Alfa",
    categoryId: "c1",
    categoryName: "Bolsas",
    currentPriceCents: 12000,
    costTotalCents: 5000,
  },
  hasPolicy: true,
  targetMarginPct: 30,
  targetMarginKind: "ideal",
  recommendedPriceCents: 15000,
  finalPriceCents: 15000,
  minPriceCents: 12000,
  premiumPriceCents: 20000,
  differenceCents: 3000,
  estimatedMarginPct: 33.3,
  originLayer: "category",
  originLabel: "Categoria",
  computedAt: "2026-07-14T12:00:00.000Z",
  explainId: "explain-abc",
  requestId: "req-1",
  summary: "R$ 150,00 (modo dynamic, custo R$ 50,00, margem 33.3%)",
  steps: [],
  warnings: [],
};

const simulateFixture = {
  currency: "BRL",
  quantity: 10,
  costTotalCents: 5000,
  minPriceCents: 12000,
  recommendedPriceCents: 15000,
  premiumPriceCents: 20000,
  targetPriceCents: 15000,
  finalPriceCents: 15000,
  grossProfitCents: 100000,
  netProfitCents: 90000,
  marginPct: 33.3,
  markupPct: 200,
  originLayer: "company",
  originLabel: "Empresa",
  strategyLabel: "Margem ideal",
  policyVersion: "hash",
  explainId: "explain-sim",
  requestId: "req-2",
  computedAt: "2026-07-14T12:00:00.000Z",
  summary: "sim",
  steps: [],
  warnings: [],
  comparison: null,
};

function makeExecutors(overrides: Partial<ToolExecutors> = {}): ToolExecutors {
  return {
    getCommercialDashboard: async () => dashboardFixture as never,
    getCompanyPolicyOverview: async () => companyFixture as never,
    getCategoryPoliciesOverview: async () => categoryFixture as never,
    getProductPricingIntelligence: async () => productExplainFixture as never,
    simulatePricing: async () => simulateFixture as never,
    applyProductSuggestedPrice: async () => ({}) as never,
    ...overrides,
  };
}

function makeOrchestrator(executors: ToolExecutors, sink?: (e: AIInteractionEvent) => void) {
  return createOrchestrator({
    router: createIntentRouter(),
    tools: createToolRegistry(createCommercialTools(executors)),
    audit: sink ? { emit: sink } : undefined,
    clock: {
      nowIso: () => "2026-07-14T12:00:00.000Z",
      traceId: () => "trace-fixed",
    },
  });
}

describe("Orchestrator — tool execution", () => {
  it("responde dashboard com sources e sem warnings", async () => {
    const orch = makeOrchestrator(makeExecutors());
    const { response, intent } = await orch.handle({
      message: "Como está meu dashboard comercial?",
      companyId: "co-1",
    });
    expect(intent.intent).toBe("commercial.dashboard");
    expect(response.summary).toContain("Saúde comercial");
    expect(response.sources.length).toBeGreaterThan(0);
    expect(response.warnings).toHaveLength(0);
    expect(response.suggestedQuestions.length).toBeGreaterThan(0);
  });

  it("responde company policy citando versão", async () => {
    const orch = makeOrchestrator(makeExecutors());
    const { response } = await orch.handle({
      message: "Qual a política comercial da empresa?",
      companyId: "co-1",
    });
    expect(response.summary).toContain("15.0%");
    expect(response.summary).toContain("30.0%");
    expect(response.sources[0]?.kind).toBe("usecase");
  });

  it("responde category policies com contagem correta", async () => {
    const orch = makeOrchestrator(makeExecutors());
    const { response } = await orch.handle({
      message: "Mostre políticas por categoria",
      companyId: "co-1",
    });
    expect(response.summary).toMatch(/2 categorias/);
  });

  it("responde product explain com engineVersions e explainId", async () => {
    const orch = makeOrchestrator(makeExecutors());
    const { response } = await orch.handle({
      message:
        "Por que esse preço do produto 11111111-2222-3333-4444-555555555555?",
      companyId: "co-1",
    });
    expect(response.engineVersions?.explainId).toBe("explain-abc");
    expect(
      response.sources.some((s) => s.kind === "pricing.explain"),
    ).toBe(true);
  });

  it("recusa product explain se productId ausente", async () => {
    const orch = makeOrchestrator(makeExecutors());
    const { response } = await orch.handle({
      message: "Por que esse preço?",
      companyId: "co-1",
    });
    expect(response.warnings.some((w) => w.code === "insufficient_context")).toBe(true);
    expect(response.sources).toHaveLength(0);
  });

  it("emite AIInteractionEvent para auditoria", async () => {
    const emitted: AIInteractionEvent[] = [];
    const orch = makeOrchestrator(makeExecutors(), (e) => emitted.push(e));
    await orch.handle({
      message: "Dashboard comercial",
      companyId: "co-1",
      userId: "user-1",
    });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.version).toBe("AIInteractionEvent.v1");
    expect(emitted[0]?.toolCalls[0]?.useCase).toBe("GetCommercialDashboard");
    expect(emitted[0]?.guardrails.length).toBeGreaterThan(0);
  });

  it("nunca vaza companyId do LLM — sempre do session", async () => {
    const spy = vi.fn(async () => dashboardFixture as never);
    const orch = makeOrchestrator(makeExecutors({ getCommercialDashboard: spy }));
    await orch.handle({
      message: "Dashboard comercial",
      companyId: "TENANT_SESSION",
    });
    expect(spy).toHaveBeenCalledWith({ companyId: "TENANT_SESSION" });
  });
});

describe("Orchestrator — guardrails & fallback", () => {
  it("retorna refusal para intent não suportada", async () => {
    const orch = makeOrchestrator(makeExecutors());
    const { response, intent } = await orch.handle({
      message: "Qual o clima hoje?",
      companyId: "co-1",
    });
    expect(intent.intent).toBe("unknown");
    expect(response.warnings[0]?.code).toBe("intent_not_supported");
    expect(response.sources).toHaveLength(0);
    // Refusal não pode citar número inventado.
    expect(response.summary).not.toMatch(/R\$/);
  });

  it("propaga erro da tool como refusalToolError", async () => {
    const orch = makeOrchestrator(
      makeExecutors({
        getCommercialDashboard: async () => {
          throw new Error("supabase offline");
        },
      }),
    );
    const { response } = await orch.handle({
      message: "Dashboard comercial",
      companyId: "co-1",
    });
    expect(response.warnings[0]?.code).toBe("tool_error");
    expect(response.warnings[0]?.message).toContain("supabase offline");
  });

  it("bloqueia summary com número mas sem source (guardrail de citação)", async () => {
    const { applyOutputGuardrails } = await import("../ai/guardrails");
    const guarded = applyOutputGuardrails(
      {
        version: "AIResponse.v1",
        summary: "Seu lucro é R$ 1.234,56.",
        confidence: "high",
        sources: [],
        actions: [],
        warnings: [],
        suggestedQuestions: [],
        traceId: "t-1",
      },
      { usedPricingTool: false },
    );
    expect(
      guarded.response.warnings.some((w) => w.code === "guardrail_triggered"),
    ).toBe(true);
    expect(guarded.response.summary).not.toContain("R$ 1.234,56");
    expect(
      guarded.checks.find((c) => c.rule === "citation.numbers_have_source")
        ?.status,
    ).toBe("block");
  });

  it("valida schema — resposta malformada é substituída por refusal", async () => {
    const { applyOutputGuardrails } = await import("../ai/guardrails");
    // summary vazio viola schema (z.string().min(1))
    const guarded = applyOutputGuardrails(
      {
        version: "AIResponse.v1",
        summary: "",
        confidence: "high",
        sources: [],
        actions: [],
        warnings: [],
        suggestedQuestions: [],
        traceId: "t-1",
      } as never,
      { usedPricingTool: false },
    );
    expect(
      guarded.checks.some(
        (c) => c.rule === "schema.aiResponse.v1" && c.status === "block",
      ),
    ).toBe(true);
    expect(guarded.response.warnings[0]?.code).toBe("guardrail_triggered");
  });
});
