/**
 * Commercial Tool Set — 1 Tool = 1 Use Case (§6.1 do blueprint).
 * Fase 1: 5 tools, todas read-only.
 */
import { z } from "zod";
import { TOOL_VERSION, type ToolDefinition } from "../contracts";
import type { ToolExecutors } from "./executors";

// ─────────────────────────────────────────────────────────────────────────────
// Schemas de I/O — permissivos no output (DTOs vêm tipados do Pricing).
// Apenas as chaves consumidas pelo formatter são validadas estritamente.
// ─────────────────────────────────────────────────────────────────────────────

const companyIdInput = z.object({ companyId: z.string().min(1) });

const productExplainInput = z.object({
  companyId: z.string().min(1),
  productId: z.string().min(1),
});

const simulateInput = z.object({
  companyId: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  channelId: z.string().nullable().optional(),
 costCents: z.number().int().nonnegative(),
 freightCents: z.number().int().nonnegative().optional(),
 packagingCents: z.number().int().nonnegative().optional(),
 insuranceCents: z.number().int().nonnegative().optional(),
 otherCostsCents: z.number().int().nonnegative().optional(),

  quantity: z.number().int().positive(),
  marginTarget: z.enum(["min", "ideal", "premium", "custom"]).optional(),
  customMarginPct: z.number().optional(),
  currentPriceCents: z.number().int().nullable().optional(),
});

// Output schemas usam `passthrough` para preservar o DTO original.
const anyRecord = z.record(z.string(), z.unknown());

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createCommercialTools(
  executors: ToolExecutors,
): readonly ToolDefinition[] {
  const dashboard: ToolDefinition = {
    version: TOOL_VERSION,
    name: "commercial.dashboard",
    intent: "commercial.dashboard",
    description:
      "Retorna o Dashboard Comercial consolidado (saúde, KPIs, oportunidades e decisões recentes).",
    inputSchema: companyIdInput,
    outputSchema: anyRecord,
    useCase: "GetCommercialDashboard",
    mutating: false,
    needsApproval: false,
    scopes: ["commercial:read"],
    execute: (input) =>
      executors.getCommercialDashboard(input as { companyId: string }),
  };

  const company: ToolDefinition = {
    version: TOOL_VERSION,
    name: "commercial.company",
    intent: "commercial.company",
    description:
      "Retorna a política comercial vigente da empresa (margens, estratégia, arredondamento).",
    inputSchema: companyIdInput,
    outputSchema: anyRecord,
    useCase: "GetCompanyPolicy",
    mutating: false,
    needsApproval: false,
    scopes: ["commercial:read"],
    execute: (input) =>
      executors.getCompanyPolicyOverview(input as { companyId: string }),
  };

  const category: ToolDefinition = {
    version: TOOL_VERSION,
    name: "commercial.category",
    intent: "commercial.category",
    description:
      "Retorna políticas por categoria (com herança) e estatística de cobertura.",
    inputSchema: companyIdInput,
    outputSchema: anyRecord,
    useCase: "GetCategoryPoliciesOverview",
    mutating: false,
    needsApproval: false,
    scopes: ["commercial:read"],
    execute: (input) =>
      executors.getCategoryPoliciesOverview(input as { companyId: string }),
  };

  const explain: ToolDefinition = {
    version: TOOL_VERSION,
    name: "commercial.product.explain",
    intent: "commercial.product.explain",
    description:
      "Explica o preço recomendado de um produto usando PricingEngine.explain().",
    inputSchema: productExplainInput,
    outputSchema: anyRecord,
    useCase: "CalculateSuggestedPrice",
    mutating: false,
    needsApproval: false,
    scopes: ["commercial:read", "products:read"],
    execute: (input) =>
      executors.getProductPricingIntelligence(
        input as { companyId: string; productId: string },
      ),
  };

  const simulate: ToolDefinition = {
    version: TOOL_VERSION,
    name: "commercial.pricing.simulate",
    intent: "commercial.pricing.simulate",
    description:
      "Simula precificação sem persistir. Consome defaultResolver + defaultEngine via Application Layer.",
    inputSchema: simulateInput,
    outputSchema: anyRecord,
    useCase: "SimulatePricing",
    mutating: false,
    needsApproval: false,
    scopes: ["commercial:read"],
    execute: (input) =>
      executors.simulatePricing(input as z.infer<typeof simulateInput>),
  };

  return [dashboard, company, category, explain, simulate];
}
