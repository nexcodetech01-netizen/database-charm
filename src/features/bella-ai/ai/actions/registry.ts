/**
 * Action Registry — catálogo curado de SAFE ACTIONS (§9 desta sprint).
 *
 * REGRAS INEGOCIÁVEIS:
 *   - Apenas ids em `SAFE_ACTIONS` podem ser registrados.
 *   - Actions NÃO instanciam repositories, engine ou supabase.
 *   - Actions "navigate" só devolvem href (ROUTES catalog).
 *   - Actions "mutation" delegam para 1 executor (que chama 1 Use Case).
 *   - Nada de batch, cancelamento, pagamento ou operação financeira nesta fase.
 */
import { ROUTES } from "@/config/routes";
import type { ApplyProductPriceResultDTO } from "@/features/pricing/lib/product-pricing.functions";
import type { ToolExecutors } from "../tools/executors";
import {
  ACTION_PROPOSAL_VERSION,
  SAFE_ACTIONS,
  type ActionExecutionResult,
  type ActionImpact,
  type ActionKind,
  type ActionProposal,
  type ActionRisk,
  type SafeActionId,
} from "./contracts";

// ─────────────────────────────────────────────────────────────────────────────
// Ports
// ─────────────────────────────────────────────────────────────────────────────

export interface ActionExecCtx {
  readonly companyId: string;
  readonly userId?: string;
  readonly traceId: string;
  readonly proposalId: string;
}

export interface ActionDefinition<TInput = unknown, TOutput = unknown> {
  readonly id: SafeActionId;
  readonly kind: ActionKind;
  readonly useCase?: string;
  /** true quando o Use Case já grava auditoria append-only (não duplicar). */
  readonly alreadyAudited: boolean;
  readonly scopes: readonly string[];
  buildProposal(input: TInput, ctx: ActionExecCtx): Promise<ActionProposal>;
  execute(
    input: TInput,
    ctx: ActionExecCtx,
  ): Promise<{ output: TOutput; alreadyAudited: boolean }>;
}

export interface ActionRegistry {
  list(): readonly SafeActionId[];
  get<TInput = unknown, TOutput = unknown>(
    id: string,
  ): ActionDefinition<TInput, TOutput> | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const brl = (cents: number) =>
  `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

interface ClockPort {
  nowIso(): string;
  proposalId(): string;
}

const defaultClock: ClockPort = {
  nowIso: () => new Date().toISOString(),
  proposalId: () =>
    `prop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Navigation actions (sem Application Layer, sem mutação)
// ─────────────────────────────────────────────────────────────────────────────

interface NavigateSpec {
  readonly id: SafeActionId;
  readonly title: string;
  readonly summary: string;
  readonly href: string;
  readonly scopes: readonly string[];
}

function buildNavigationAction(
  spec: NavigateSpec,
  clock: ClockPort,
): ActionDefinition<{ href?: string }, { href: string }> {
  return {
    id: spec.id,
    kind: "navigate",
    alreadyAudited: false,
    scopes: spec.scopes,
    async buildProposal(input, ctx) {
      const href = input?.href ?? spec.href;
      return {
        version: ACTION_PROPOSAL_VERSION,
        proposalId: ctx.proposalId,
        actionId: spec.id,
        kind: "navigate",
        title: spec.title,
        summary: spec.summary,
        impact: [{ label: "Destino", value: href }],
        risks: [],
        scopes: [...spec.scopes],
        payload: { href },
        href,
        requiresConfirmation: true,
        createdAt: clock.nowIso(),
        companyId: ctx.companyId,
      };
    },
    async execute(input) {
      const href = input?.href ?? spec.href;
      return { output: { href }, alreadyAudited: false };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// applySuggestedPrice — mutating, delega ApplySuggestedPrice + RegisterPricingDecision
// ─────────────────────────────────────────────────────────────────────────────

export interface ApplySuggestedPriceInput {
  readonly productId: string;
  readonly strategy?: "min" | "recommended" | "premium" | "target" | "final";
}

function buildApplySuggestedPriceAction(
  executors: ToolExecutors,
  clock: ClockPort,
): ActionDefinition<ApplySuggestedPriceInput, ApplyProductPriceResultDTO> {
  return {
    id: "applySuggestedPrice",
    kind: "mutation",
    // O executor delega para o server function `applyProductSuggestedPrice`,
    // que internamente chama `RegisterPricingDecision` (append-only).
    // Portanto o AIInteractionEvent NÃO deve duplicar auditoria.
    useCase: "ApplySuggestedPrice+RegisterPricingDecision",
    alreadyAudited: true,
    scopes: ["commercial:write", "products:write"],
    async buildProposal(input, ctx) {
      if (!input?.productId) {
        throw new Error("productId é obrigatório");
      }
      // Preview read-only (mesmo UC do explain — não persiste, não muta).
      const intel = await executors.getProductPricingIntelligence({
        companyId: ctx.companyId,
        productId: input.productId,
      });

      const current = intel.product.currentPriceCents;
      const target = intel.finalPriceCents;
      const delta = target - current;
      const risks: ActionRisk[] = [];
      if (!intel.hasPolicy) {
        risks.push({
          code: "missing_policy",
          message:
            "Produto sem política própria — o preço usa herança de categoria/empresa.",
        });
      }
      if (target < intel.minPriceCents) {
        risks.push({
          code: "below_min",
          message: "Preço final abaixo do piso configurado.",
        });
      }
      const impact: ActionImpact[] = [
        { label: "Produto", value: intel.product.name },
        { label: "Preço atual", value: brl(current) },
        { label: "Novo preço", value: brl(target) },
        {
          label: "Impacto",
          value: `${delta >= 0 ? "+" : ""}${brl(delta)}`,
          tone: delta >= 0 ? "positive" : "warning",
        },
        {
          label: "Margem estimada",
          value: `${intel.estimatedMarginPct.toFixed(1)}%`,
        },
      ];

      return {
        version: ACTION_PROPOSAL_VERSION,
        proposalId: ctx.proposalId,
        actionId: "applySuggestedPrice",
        kind: "mutation",
        title: "Aplicar preço sugerido",
        summary: `Atualizar preço de "${intel.product.name}" de ${brl(current)} para ${brl(target)} conforme política ${intel.originLabel}.`,
        impact,
        risks,
        scopes: ["commercial:write", "products:write"],
        payload: {
          productId: input.productId,
          strategy: input.strategy ?? "final",
          explainId: intel.explainId,
        },
        requiresConfirmation: true,
        createdAt: clock.nowIso(),
        companyId: ctx.companyId,
      };
    },
    async execute(input, ctx) {
      const out = await executors.applyProductSuggestedPrice({
        companyId: ctx.companyId,
        productId: input.productId,
        strategy: input.strategy ?? "final",
      });
      return { output: out, alreadyAudited: true };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export interface ActionRegistryDeps {
  readonly executors: ToolExecutors;
  readonly clock?: ClockPort;
}

export function createActionRegistry(deps: ActionRegistryDeps): ActionRegistry {
  const clock = deps.clock ?? defaultClock;
  const defs: Record<SafeActionId, ActionDefinition<unknown, unknown>> = {
    applySuggestedPrice: buildApplySuggestedPriceAction(
      deps.executors,
      clock,
    ) as ActionDefinition<unknown, unknown>,
    openProduct: buildNavigationAction(
      {
        id: "openProduct",
        title: "Abrir produto",
        summary: "Abrir a ficha do produto selecionado.",
        href: ROUTES.products,
        scopes: ["products:read"],
      },
      clock,
    ) as ActionDefinition<unknown, unknown>,
    openCommercialDashboard: buildNavigationAction(
      {
        id: "openCommercialDashboard",
        title: "Abrir Dashboard Comercial",
        summary: "Ir para o Dashboard de Inteligência Comercial.",
        href: ROUTES.commercialDashboard,
        scopes: ["commercial:read"],
      },
      clock,
    ) as ActionDefinition<unknown, unknown>,
    openPricingSimulator: buildNavigationAction(
      {
        id: "openPricingSimulator",
        title: "Abrir Simulador de Preços",
        summary: "Abrir o Simulador de Precificação.",
        href: ROUTES.commercialSimulator,
        scopes: ["commercial:read"],
      },
      clock,
    ) as ActionDefinition<unknown, unknown>,
    openCategoryPolicy: buildNavigationAction(
      {
        id: "openCategoryPolicy",
        title: "Abrir Políticas por Categoria",
        summary: "Ver políticas comerciais por categoria.",
        href: ROUTES.commercialCategories,
        scopes: ["commercial:read"],
      },
      clock,
    ) as ActionDefinition<unknown, unknown>,
    openCompanyPolicy: buildNavigationAction(
      {
        id: "openCompanyPolicy",
        title: "Abrir Política da Empresa",
        summary: "Ver a política comercial vigente da empresa.",
        href: ROUTES.commercialPolicy,
        scopes: ["commercial:read"],
      },
      clock,
    ) as ActionDefinition<unknown, unknown>,
  };

  return {
    list: () => SAFE_ACTIONS,
    get<TInput, TOutput>(id: string) {
      if (!(SAFE_ACTIONS as readonly string[]).includes(id)) return undefined;
      return defs[id as SafeActionId] as ActionDefinition<TInput, TOutput>;
    },
  };
}

// re-exports públicos para consumidores
export type { ActionExecutionResult, ActionProposal };
