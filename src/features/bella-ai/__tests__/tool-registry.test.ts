import { describe, expect, it } from "vitest";
import {
  createCommercialTools,
  createToolRegistry,
  type ToolExecutors,
} from "../ai";

const noopExecutors: ToolExecutors = {
  getCommercialDashboard: async () => ({}) as never,
  getCompanyPolicyOverview: async () => ({}) as never,
  getCategoryPoliciesOverview: async () => ({}) as never,
  getProductPricingIntelligence: async () => ({}) as never,
  simulatePricing: async () => ({}) as never,
  applyProductSuggestedPrice: async () => ({}) as never,
};

describe("Tool Registry", () => {
  const tools = createCommercialTools(noopExecutors);
  const registry = createToolRegistry(tools);

  it("registra 5 tools do domínio comercial", () => {
    expect(registry.list()).toHaveLength(5);
  });

  it("indexa por nome canônico", () => {
    expect(registry.getByName("commercial.dashboard")?.useCase).toBe(
      "GetCommercialDashboard",
    );
    expect(registry.getByName("commercial.company")?.useCase).toBe(
      "GetCompanyPolicy",
    );
    expect(registry.getByName("commercial.category")?.useCase).toBe(
      "GetCategoryPoliciesOverview",
    );
    expect(registry.getByName("commercial.product.explain")?.useCase).toBe(
      "CalculateSuggestedPrice",
    );
    expect(registry.getByName("commercial.pricing.simulate")?.useCase).toBe(
      "SimulatePricing",
    );
  });

  it("indexa por intent", () => {
    expect(registry.getByIntent("commercial.dashboard")?.name).toBe(
      "commercial.dashboard",
    );
  });

  it("marca todas as tools como read-only na Fase 1", () => {
    for (const t of registry.list()) {
      expect(t.mutating).toBe(false);
      expect(t.needsApproval).toBe(false);
    }
  });

  it("rejeita nomes duplicados", () => {
    const dup = [...tools, tools[0]!];
    expect(() => createToolRegistry(dup)).toThrow(/duplicada/);
  });

  it("retorna undefined para nome desconhecido", () => {
    expect(registry.getByName("finance.cashPosition")).toBeUndefined();
  });
});
