import { describe, expect, it } from "vitest";
import { applyOutputGuardrails } from "../ai";
import {
  formatCompanyPolicy,
  formatCategoryPolicies,
  formatDashboard,
  formatProductExplain,
  formatSimulation,
  refusalMissingData,
  refusalToolError,
} from "../ai/formatter/response-formatter";
import {
  createIntentRouter,
  createToolRegistry,
  createCommercialTools,
  createOrchestrator,
  type ToolExecutors,
} from "../ai";

describe("Formatter — casos degenerados", () => {
  it("normaliza warnings desconhecidos como insufficient_context (product)", () => {
    const r = formatProductExplain(
      {
        product: { name: "X", currentPriceCents: 0 },
        recommendedPriceCents: 0,
        differenceCents: 0,
        estimatedMarginPct: 0,
        originLabel: "—",
        explainId: "e1",
        warnings: [{ code: "SOMETHING_WEIRD", message: "?" }],
      },
      { traceId: "t", toolCall: "commercial.product.explain", useCase: "UC" },
    );
    expect(r.warnings[0]?.code).toBe("insufficient_context");
  });

  it("normaliza warnings conhecidos preservando o código (simulate)", () => {
    const r = formatSimulation(
      {
        finalPriceCents: 0,
        marginPct: 0,
        markupPct: 0,
        recommendedPriceCents: 0,
        minPriceCents: 0,
        premiumPriceCents: 0,
        explainId: "e2",
        warnings: [{ code: "missing_cost", message: "sem custo" }],
      },
      { traceId: "t", toolCall: "commercial.pricing.simulate", useCase: "UC" },
    );
    expect(r.warnings[0]?.code).toBe("missing_cost");
  });

  it("company sem política → confidence low + warning missing_policy", () => {
    const r = formatCompanyPolicy(
      { policy: null, stats: null },
      { traceId: "t", toolCall: "commercial.company", useCase: "UC" },
    );
    expect(r.confidence).toBe("low");
    expect(r.warnings[0]?.code).toBe("missing_policy");
  });

  it("category sem linhas → insufficient_context", () => {
    const r = formatCategoryPolicies(
      { rows: [] },
      { traceId: "t", toolCall: "commercial.category", useCase: "UC" },
    );
    expect(r.warnings[0]?.code).toBe("insufficient_context");
  });

  it("aceita DTOs vazios e usa fallbacks (branches ??)", () => {
    const ctx = { traceId: "t", toolCall: "x", useCase: "UC" } as const;
    const a = formatProductExplain({}, ctx);
    const b = formatSimulation({}, ctx);
    const c = formatDashboard({}, ctx);
    const d = formatCompanyPolicy({}, ctx);
    const e = formatCategoryPolicies({ rows: [{ policy: null }, { policy: {} }] }, ctx);
    expect(a.summary).toContain("R$ 0,00");
    expect(b.summary).toContain("R$ 0,00");
    expect(c.summary).toContain("0★");
    expect(d.confidence).toBe("low");
    expect(e.summary).toMatch(/2 categorias/);
  });

  it("refusalMissingData e refusalToolError geram AIResponse válida", () => {
    const a = refusalMissingData("missing_cost", "sem custo", "t");
    const b = refusalToolError("commercial.dashboard", "boom", "t");
    expect(a.warnings[0]?.code).toBe("missing_cost");
    expect(b.warnings[0]?.code).toBe("tool_error");
  });
});

describe("Guardrails — explain check", () => {
  it("emite warn quando pricing tool foi usada sem explainId", () => {
    const { checks } = applyOutputGuardrails(
      {
        version: "AIResponse.v1",
        summary: "Consulta feita.",
        confidence: "high",
        sources: [
          {
            kind: "usecase",
            useCase: "UC",
            toolCall: "commercial.product.explain",
            traceId: "t",
          },
        ],
        actions: [],
        warnings: [],
        suggestedQuestions: [],
        traceId: "t",
      },
      { usedPricingTool: true },
    );
    expect(
      checks.find((c) => c.rule === "explain.explain_id_present")?.status,
    ).toBe("warn");
  });

  it("passa quando pricing tool foi usada com explainId", () => {
    const { checks } = applyOutputGuardrails(
      {
        version: "AIResponse.v1",
        summary: "ok",
        confidence: "high",
        sources: [
          { kind: "pricing.explain", explainId: "e1", toolCall: "x" },
        ],
        actions: [],
        warnings: [],
        suggestedQuestions: [],
        traceId: "t",
        engineVersions: {
          engineVersion: "v",
          calculationVersion: "v",
          policyVersion: "v",
          explainId: "e1",
        },
      },
      { usedPricingTool: true },
    );
    expect(
      checks.find((c) => c.rule === "explain.explain_id_present")?.status,
    ).toBe("pass");
  });
});

describe("Orchestrator — fallback quando tool não existe para intent", () => {
  // Constrói um router customizado que retorna uma intent válida
  // mas o registry propositalmente NÃO tem a tool → cai no branch de fallback.
  it("cai em intent_not_supported quando registry não tem a tool", async () => {
    const emptyExecutors: ToolExecutors = {
      getCommercialDashboard: async () => ({}) as never,
      getCompanyPolicyOverview: async () => ({}) as never,
      getCategoryPoliciesOverview: async () => ({}) as never,
      getProductPricingIntelligence: async () => ({}) as never,
      simulatePricing: async () => ({}) as never,
      applyProductSuggestedPrice: async () => ({}) as never,
    };
    const allTools = createCommercialTools(emptyExecutors);
    // Remove todas menos "commercial.category" para forçar o miss em "commercial.dashboard".
    const partial = allTools.filter(
      (t) => t.name === "commercial.category",
    );
    const orch = createOrchestrator({
      router: createIntentRouter(),
      tools: createToolRegistry(partial),
    });
    const { response } = await orch.handle({
      message: "Como está meu dashboard comercial?",
      companyId: "co-1",
    });
    expect(response.warnings[0]?.code).toBe("intent_not_supported");
    expect(response.sources).toHaveLength(0);
  });
});
