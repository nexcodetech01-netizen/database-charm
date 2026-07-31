/**
 * Workflow Registry — discovery + execução, ambos delegados à Application Layer.
 *
 * Cada workflow define:
 *   - `discover(...)`: 1 chamada read-only ao dashboard comercial, filtro DTO
 *     em memória (não é regra de negócio — apenas seleção).
 *   - `execute(...)`: iteração item-a-item chamando `applyProductSuggestedPrice`
 *     (que encapsula `ApplySuggestedPrice + RegisterPricingDecision`).
 *   - Não há SQL, não há repositórios, não há cálculo próprio.
 */
import type { ToolExecutors } from "../tools/executors";
import type {
  PriceReviewItemDTO,
  PriceReviewReason,
  CommercialDashboardDTO,
} from "@/features/pricing/lib/commercial-dashboard.functions";
import {
  WORKFLOWS,
  type WorkflowId,
  type WorkflowTarget,
} from "./contracts";

// ─────────────────────────────────────────────────────────────────────────────
// Filtros por workflow
// ─────────────────────────────────────────────────────────────────────────────

interface DiscoveryInput {
  readonly companyId: string;
  readonly categoryId?: string;
}

interface DiscoveryOutput {
  readonly items: readonly PriceReviewItemDTO[];
  readonly estimatedRevenueDeltaCents: number;
  readonly categoryName?: string;
}

function toTarget(item: PriceReviewItemDTO): WorkflowTarget {
  return {
    productId: item.productId,
    name: item.name,
    currentPriceCents: item.currentPriceCents,
    recommendedPriceCents: item.recommendedPriceCents,
    differenceCents: item.differenceCents,
    primaryReason: item.primaryReason,
  };
}

function sumDelta(items: readonly PriceReviewItemDTO[]): number {
  return items.reduce((acc, i) => acc + i.differenceCents, 0);
}

function hasReason(
  item: PriceReviewItemDTO,
  reason: PriceReviewReason,
): boolean {
  return item.reasons.includes(reason);
}

type DiscoverFn = (
  input: DiscoveryInput,
  dashboard: CommercialDashboardDTO,
) => DiscoveryOutput;

const discoveryByWorkflow: Record<WorkflowId, DiscoverFn> = {
  reviewCategoryPrices(input, dashboard) {
    if (!input.categoryId) {
      throw new Error("categoryId é obrigatório para reviewCategoryPrices");
    }
    const items = dashboard.reviewList.filter(
      (i) => i.categoryId === input.categoryId,
    );
    const categoryName =
      items[0]?.categoryName ??
      dashboard.categories.find((c) => c.categoryId === input.categoryId)?.name;
    return { items, estimatedRevenueDeltaCents: sumDelta(items), categoryName };
  },
  reviewProductsWithPendingSuggestion(_input, dashboard) {
    const items = dashboard.reviewList.filter(
      (i) =>
        hasReason(i, "pending_suggestion") || hasReason(i, "price_differs"),
    );
    return { items, estimatedRevenueDeltaCents: sumDelta(items) };
  },
  reviewProductsBelowMargin(_input, dashboard) {
    const items = dashboard.reviewList.filter((i) =>
      hasReason(i, "below_min_margin"),
    );
    return { items, estimatedRevenueDeltaCents: sumDelta(items) };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry API
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowDefinition {
  readonly id: WorkflowId;
  readonly title: string;
  readonly baseSummary: string;
  readonly scopes: readonly string[];
  readonly useCase: string;
  readonly alreadyAudited: boolean;
  discover(
    input: DiscoveryInput,
    dashboard: CommercialDashboardDTO,
  ): DiscoveryOutput;
}

export interface WorkflowRegistry {
  list(): readonly WorkflowId[];
  get(id: string): WorkflowDefinition | undefined;
}

export function createWorkflowRegistry(_deps: {
  executors: ToolExecutors;
}): WorkflowRegistry {
  const defs: Record<WorkflowId, WorkflowDefinition> = {
    reviewCategoryPrices: {
      id: "reviewCategoryPrices",
      title: "Revisar preços da categoria",
      baseSummary:
        "Aplicar o preço sugerido em todos os produtos elegíveis de uma categoria.",
      scopes: ["commercial:write", "products:write"],
      useCase: "ApplySuggestedPrice+RegisterPricingDecision (per item)",
      alreadyAudited: true,
      discover: discoveryByWorkflow.reviewCategoryPrices,
    },
    reviewProductsWithPendingSuggestion: {
      id: "reviewProductsWithPendingSuggestion",
      title: "Aplicar sugestões pendentes",
      baseSummary:
        "Aplicar o preço sugerido em produtos com sugestão pendente ou preço diferente do recomendado.",
      scopes: ["commercial:write", "products:write"],
      useCase: "ApplySuggestedPrice+RegisterPricingDecision (per item)",
      alreadyAudited: true,
      discover: discoveryByWorkflow.reviewProductsWithPendingSuggestion,
    },
    reviewProductsBelowMargin: {
      id: "reviewProductsBelowMargin",
      title: "Corrigir produtos abaixo da margem",
      baseSummary:
        "Aplicar o preço recomendado nos produtos que estão abaixo da margem mínima.",
      scopes: ["commercial:write", "products:write"],
      useCase: "ApplySuggestedPrice+RegisterPricingDecision (per item)",
      alreadyAudited: true,
      discover: discoveryByWorkflow.reviewProductsBelowMargin,
    },
  };
  return {
    list: () => WORKFLOWS,
    get: (id) =>
      (WORKFLOWS as readonly string[]).includes(id)
        ? defs[id as WorkflowId]
        : undefined,
  };
}
