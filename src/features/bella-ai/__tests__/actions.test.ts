import { describe, expect, it, vi } from "vitest";
import {
  createActionExecutor,
  createActionRegistry,
  formatActionProposal,
  formatActionResult,
  guardActionRequest,
  SAFE_ACTIONS,
  type AIInteractionEvent,
  type ActionProposal,
  type ToolExecutors,
} from "../ai";

const productIntel = {
  product: { id: "p1", name: "Bolsa Milano", currentPriceCents: 11990 },
  finalPriceCents: 12990,
  minPriceCents: 10000,
  estimatedMarginPct: 32.5,
  hasPolicy: true,
  originLabel: "categoria",
  explainId: "exp-1",
};

function makeExecutors(overrides: Partial<ToolExecutors> = {}): ToolExecutors {
  return {
    getCommercialDashboard: async () => ({}) as never,
    getCompanyPolicyOverview: async () => ({}) as never,
    getCategoryPoliciesOverview: async () => ({}) as never,
    getProductPricingIntelligence: async () => productIntel as never,
    simulatePricing: async () => ({}) as never,
    applyProductSuggestedPrice: async () =>
      ({
        productId: "p1",
        appliedPriceCents: 12990,
        explainId: "exp-1",
        decisionId: "dec-1",
      }) as never,
    ...overrides,
  };
}

function makeExecutor(overrides: Partial<ToolExecutors> = {}) {
  const events: AIInteractionEvent[] = [];
  const executor = createActionExecutor({
    registry: createActionRegistry({ executors: makeExecutors(overrides) }),
    audit: { emit: (e) => events.push(e) },
    clock: {
      nowIso: () => "2026-07-14T00:00:00.000Z",
      traceId: () => "trace-x",
    },
  });
  return { executor, events };
}

describe("Action Registry", () => {
  it("expõe apenas SAFE_ACTIONS", () => {
    const reg = createActionRegistry({ executors: makeExecutors() });
    expect(reg.list()).toEqual(SAFE_ACTIONS);
    expect(reg.get("deleteProduct")).toBeUndefined();
  });
});

describe("Guardrails", () => {
  it("bloqueia action fora da allow-list", () => {
    expect(guardActionRequest("deleteProduct", {}).ok).toBe(false);
  });
  it("bloqueia batch", () => {
    expect(
      guardActionRequest("applySuggestedPrice", { ids: ["a", "b"] }).ok,
    ).toBe(false);
  });
  it("aceita SAFE ACTION", () => {
    expect(guardActionRequest("applySuggestedPrice", { productId: "p1" }).ok).toBe(true);
  });
});

describe("Action Executor — propose", () => {
  it("gera proposta de aplicação de preço com impacto e requiresConfirmation", async () => {
    const { executor, events } = makeExecutor();
    const out = await executor.propose(
      { actionId: "applySuggestedPrice", payload: { productId: "p1" } },
      { companyId: "c1", userId: "u1" },
    );
    expect(out.refusal).toBeUndefined();
    expect(out.proposal?.requiresConfirmation).toBe(true);
    expect(out.proposal?.impact.length).toBeGreaterThan(0);
    expect(events[0].action?.actionExecuted).toBe(false);
  });

  it("recusa action bloqueada por guardrail sem chamar executor", async () => {
    const spy = vi.fn();
    const { executor } = makeExecutor({
      applyProductSuggestedPrice: spy as never,
    });
    const out = await executor.propose(
      { actionId: "applySuggestedPrice", payload: { ids: ["a", "b"] } },
      { companyId: "c1" },
    );
    expect(out.refusal).toBeDefined();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("Action Executor — confirm", () => {
  it("bloqueia execução sem confirmed=true", async () => {
    const spy = vi.fn(async () => ({ productId: "p1" }) as never);
    const { executor } = makeExecutor({
      applyProductSuggestedPrice: spy as never,
    });
    const prop = (
      await executor.propose(
        { actionId: "applySuggestedPrice", payload: { productId: "p1" } },
        { companyId: "c1" },
      )
    ).proposal as ActionProposal;
    const res = await executor.confirm(
      { proposal: prop, confirmed: false },
      { companyId: "c1" },
    );
    expect(res.result.status).toBe("cancelled");
    expect(spy).not.toHaveBeenCalled();
  });

  it("executa via Application Layer quando confirmed=true e emite audit event", async () => {
    const { executor, events } = makeExecutor();
    const prop = (
      await executor.propose(
        { actionId: "applySuggestedPrice", payload: { productId: "p1" } },
        { companyId: "c1", userId: "u1" },
      )
    ).proposal as ActionProposal;
    const res = await executor.confirm(
      { proposal: prop, confirmed: true },
      { companyId: "c1", userId: "u1" },
    );
    expect(res.result.status).toBe("executed");
    expect(res.result.alreadyAudited).toBe(true);
    const exec = events.find((e) => e.action?.actionExecuted);
    expect(exec?.action?.useCase).toContain("ApplySuggestedPrice");
    // não duplica auditoria fiscal
    expect(exec?.action?.alreadyAudited).toBe(true);
  });

  it("bloqueia troca de tenant no confirm", async () => {
    const { executor } = makeExecutor();
    const prop = (
      await executor.propose(
        { actionId: "applySuggestedPrice", payload: { productId: "p1" } },
        { companyId: "c1" },
      )
    ).proposal as ActionProposal;
    const res = await executor.confirm(
      { proposal: prop, confirmed: true },
      { companyId: "OTHER" },
    );
    expect(res.result.status).toBe("failed");
    expect(res.result.error).toBe("tenant_mismatch");
  });
});

describe("Navigation actions", () => {
  it("openCommercialDashboard retorna href sem tocar Application Layer", async () => {
    const spy = vi.fn();
    const { executor } = makeExecutor({
      getCommercialDashboard: spy as never,
    });
    const out = await executor.propose(
      { actionId: "openCommercialDashboard", payload: {} },
      { companyId: "c1" },
    );
    expect(out.proposal?.kind).toBe("navigate");
    expect(out.proposal?.href).toBeDefined();
    const res = await executor.confirm(
      { proposal: out.proposal as ActionProposal, confirmed: true },
      { companyId: "c1" },
    );
    expect(res.result.status).toBe("executed");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("Formatter", () => {
  it("formatActionProposal expõe botões Confirmar/Cancelar", async () => {
    const { executor } = makeExecutor();
    const prop = (
      await executor.propose(
        { actionId: "applySuggestedPrice", payload: { productId: "p1" } },
        { companyId: "c1" },
      )
    ).proposal as ActionProposal;
    const res = formatActionProposal(prop, "t1");
    expect(res.actions.map((a) => a.label).sort()).toEqual([
      "Cancelar",
      "Confirmar",
    ]);
  });

  it("formatActionResult reporta sucesso", () => {
    const proposal = {
      proposalId: "p",
      actionId: "applySuggestedPrice",
      title: "Aplicar preço sugerido",
      summary: "s",
      scopes: [],
      risks: [],
      impact: [],
    } as unknown as ActionProposal;
    const res = formatActionResult(
      proposal,
      {
        version: "ActionExecutionResult.v1",
        proposalId: "p",
        actionId: "applySuggestedPrice",
        status: "executed",
        executionTimeMs: 5,
        alreadyAudited: true,
      },
      "t1",
    );
    expect(res.summary).toContain("aplicada com sucesso");
  });
});
