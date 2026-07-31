import { describe, expect, it, vi } from "vitest";
import {
  createWorkflowExecutor,
  createWorkflowRegistry,
  guardWorkflowRequest,
  WORKFLOWS,
  type AIInteractionEvent,
  type ToolExecutors,
  type WorkflowProposal,
} from "../ai";

const dashboardFixture = {
  health: { level: "good", stars: 3, label: "Bom", summary: "" },
  kpis: {},
  opportunities: [],
  priorityProducts: [],
  categories: [
    {
      categoryId: "cat-bolsas",
      name: "Bolsas",
      averageMarginPct: 30,
      productsCount: 3,
      pendingProducts: 2,
      strategyLabel: "standard",
      hasOwnPolicy: true,
    },
  ],
  recentDecisions: [],
  insights: [],
  reviewList: [
    {
      productId: "p1",
      name: "Bolsa A",
      categoryId: "cat-bolsas",
      categoryName: "Bolsas",
      supplierId: null,
      supplierName: null,
      currentPriceCents: 10000,
      recommendedPriceCents: 12000,
      differenceCents: 2000,
      currentMarginPct: 20,
      targetMarginPct: 30,
      originLayer: "category",
      originLabel: "Categoria",
      reasons: ["pending_suggestion", "below_min_margin"],
      primaryReason: "below_min_margin",
      hasOwnPolicy: false,
      lastUpdatedAt: "2026-07-14T00:00:00.000Z",
    },
    {
      productId: "p2",
      name: "Bolsa B",
      categoryId: "cat-bolsas",
      categoryName: "Bolsas",
      supplierId: null,
      supplierName: null,
      currentPriceCents: 15000,
      recommendedPriceCents: 15000,
      differenceCents: 0,
      currentMarginPct: 30,
      targetMarginPct: 30,
      originLayer: "category",
      originLabel: "Categoria",
      reasons: ["pending_suggestion"],
      primaryReason: "pending_suggestion",
      hasOwnPolicy: false,
      lastUpdatedAt: "2026-07-14T00:00:00.000Z",
    },
    {
      productId: "p3",
      name: "Sapato",
      categoryId: "cat-sapatos",
      categoryName: "Sapatos",
      supplierId: null,
      supplierName: null,
      currentPriceCents: 20000,
      recommendedPriceCents: 22000,
      differenceCents: 2000,
      currentMarginPct: 10,
      targetMarginPct: 25,
      originLayer: "category",
      originLabel: "Categoria",
      reasons: ["below_min_margin"],
      primaryReason: "below_min_margin",
      hasOwnPolicy: true,
      lastUpdatedAt: "2026-07-14T00:00:00.000Z",
    },
  ],
};

function makeExecutors(
  overrides: Partial<ToolExecutors> = {},
): ToolExecutors {
  return {
    getCommercialDashboard: async () => dashboardFixture as never,
    getCompanyPolicyOverview: async () => ({}) as never,
    getCategoryPoliciesOverview: async () => ({}) as never,
    getProductPricingIntelligence: async () => ({}) as never,
    simulatePricing: async () => ({}) as never,
    applyProductSuggestedPrice: async ({ productId }) =>
      ({
        productId,
        appliedPriceCents:
          dashboardFixture.reviewList.find((r) => r.productId === productId)
            ?.recommendedPriceCents ?? 0,
        explainId: `exp-${productId}`,
        decisionId: `dec-${productId}`,
      }) as never,
    ...overrides,
  };
}

function makeExecutor(overrides: Partial<ToolExecutors> = {}) {
  const events: AIInteractionEvent[] = [];
  const executors = makeExecutors(overrides);
  const executor = createWorkflowExecutor({
    registry: createWorkflowRegistry({ executors }),
    executors,
    audit: { emit: (e) => events.push(e) },
    clock: {
      nowIso: () => "2026-07-14T00:00:00.000Z",
      traceId: () => "trace-w",
    },
  });
  return { executor, events };
}

describe("Workflow Registry", () => {
  it("expõe apenas os 3 workflows comerciais", () => {
    const reg = createWorkflowRegistry({ executors: makeExecutors() });
    expect(reg.list()).toEqual(WORKFLOWS);
    expect(reg.get("bulkCancelOrders")).toBeUndefined();
  });
});

describe("Workflow Guardrails", () => {
  it("bloqueia workflow fora da allow-list", () => {
    expect(guardWorkflowRequest("bulkDelete", {}).ok).toBe(false);
  });
  it("bloqueia batch de múltiplas categorias", () => {
    expect(
      guardWorkflowRequest("reviewCategoryPrices", {
        categoryIds: ["a", "b"],
      }).ok,
    ).toBe(false);
  });
  it("aceita reviewCategoryPrices", () => {
    expect(
      guardWorkflowRequest("reviewCategoryPrices", { categoryId: "cat-bolsas" })
        .ok,
    ).toBe(true);
  });
});

describe("Workflow propose", () => {
  it("reviewCategoryPrices filtra por categoria e monta impacto", async () => {
    const { executor } = makeExecutor();
    const out = await executor.propose(
      {
        workflowId: "reviewCategoryPrices",
        payload: { categoryId: "cat-bolsas" },
      },
      { companyId: "c1" },
    );
    expect(out.proposal?.totalItems).toBe(2);
    expect(out.proposal?.estimatedRevenueDeltaCents).toBe(2000);
    expect(out.proposal?.requiresConfirmation).toBe(true);
    expect(out.proposal?.impact.find((i) => i.label === "Categoria")?.value).toBe(
      "Bolsas",
    );
  });

  it("reviewProductsBelowMargin filtra por reason", async () => {
    const { executor } = makeExecutor();
    const out = await executor.propose(
      { workflowId: "reviewProductsBelowMargin", payload: {} },
      { companyId: "c1" },
    );
    expect(out.proposal?.totalItems).toBe(2);
    expect(out.proposal?.targets.map((t) => t.productId).sort()).toEqual([
      "p1",
      "p3",
    ]);
  });

  it("propose NÃO chama applyProductSuggestedPrice", async () => {
    const spy = vi.fn();
    const { executor } = makeExecutor({
      applyProductSuggestedPrice: spy as never,
    });
    await executor.propose(
      {
        workflowId: "reviewCategoryPrices",
        payload: { categoryId: "cat-bolsas" },
      },
      { companyId: "c1" },
    );
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("Workflow confirm", () => {
  it("bloqueia execução sem confirmed=true", async () => {
    const spy = vi.fn(async () => ({}) as never);
    const { executor } = makeExecutor({
      applyProductSuggestedPrice: spy as never,
    });
    const prop = (
      await executor.propose(
        {
          workflowId: "reviewCategoryPrices",
          payload: { categoryId: "cat-bolsas" },
        },
        { companyId: "c1" },
      )
    ).proposal as WorkflowProposal;
    const res = await executor.confirm(
      { proposal: prop, confirmed: false },
      { companyId: "c1" },
    );
    expect(res.report.status).toBe("cancelled");
    expect(spy).not.toHaveBeenCalled();
  });

  it("bloqueia troca de empresa entre propose e confirm", async () => {
    const { executor } = makeExecutor();
    const prop = (
      await executor.propose(
        {
          workflowId: "reviewCategoryPrices",
          payload: { categoryId: "cat-bolsas" },
        },
        { companyId: "c1" },
      )
    ).proposal as WorkflowProposal;
    const res = await executor.confirm(
      { proposal: prop, confirmed: true },
      { companyId: "OTHER" },
    );
    expect(res.report.status).toBe("failed");
    expect(res.guard.code).toBe("tenant_mismatch");
  });

  it("executa item-a-item, ignora diff=0 e produz relatório completo", async () => {
    const { executor, events } = makeExecutor();
    const prop = (
      await executor.propose(
        {
          workflowId: "reviewCategoryPrices",
          payload: { categoryId: "cat-bolsas" },
        },
        { companyId: "c1", userId: "u1" },
      )
    ).proposal as WorkflowProposal;
    const res = await executor.confirm(
      { proposal: prop, confirmed: true },
      { companyId: "c1", userId: "u1" },
    );
    expect(res.report.status).toBe("executed");
    expect(res.report.productsProcessed).toBe(2);
    expect(res.report.productsUpdated).toBe(1);
    expect(res.report.productsSkipped).toBe(1);
    expect(res.report.productsFailed).toBe(0);
    expect(res.report.appliedRevenueDeltaCents).toBe(2000);
    expect(res.report.alreadyAudited).toBe(true);
    const wf = events.find((e) => e.workflow?.productsProcessed);
    expect(wf?.workflow?.alreadyAudited).toBe(true);
  });

  it("captura falha por item e NÃO aborta o workflow", async () => {
    let calls = 0;
    const { executor } = makeExecutor({
      applyProductSuggestedPrice: async ({ productId }) => {
        calls++;
        if (productId === "p1") throw new Error("motor indisponível");
        return {
          productId,
          appliedPriceCents: 22000,
          explainId: "e",
          decisionId: "d",
        } as never;
      },
    });
    const prop = (
      await executor.propose(
        { workflowId: "reviewProductsBelowMargin", payload: {} },
        { companyId: "c1" },
      )
    ).proposal as WorkflowProposal;
    const res = await executor.confirm(
      { proposal: prop, confirmed: true },
      { companyId: "c1" },
    );
    expect(calls).toBe(2); // executou p1 (falhou) e p3 (ok)
    expect(res.report.productsUpdated).toBe(1);
    expect(res.report.productsFailed).toBe(1);
    expect(res.report.items.find((i) => i.productId === "p1")?.error).toContain(
      "motor",
    );
  });

  it("emite onItem para cada produto processado", async () => {
    const seen: string[] = [];
    const { executor } = makeExecutor();
    const prop = (
      await executor.propose(
        {
          workflowId: "reviewCategoryPrices",
          payload: { categoryId: "cat-bolsas" },
        },
        { companyId: "c1" },
      )
    ).proposal as WorkflowProposal;
    await executor.confirm(
      {
        proposal: prop,
        confirmed: true,
        onItem: (r) => seen.push(`${r.productId}:${r.status}`),
      },
      { companyId: "c1" },
    );
    expect(seen).toEqual(["p1:updated", "p2:skipped"]);
  });
});
