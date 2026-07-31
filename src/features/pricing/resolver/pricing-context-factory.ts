/**
 * PricingContextFactory
 * =====================
 *
 * Ponto de entrada da camada Policy Resolver.
 * Orquestra: Company → Category → Product → merge → PriceList → snapshots
 * e devolve `{ context, resolution }` pronto para o Core.
 *
 * O Core (`compute`/`explain`) NÃO é chamado aqui — separação estrita.
 * Quem opera o pipeline chama:
 *
 *   const { context } = buildPricingContext(input);
 *   const result = compute(context);
 *
 * PURO. Sem I/O. Não conhece React/Supabase/HTTP.
 */
import {
  CONTEXT_VERSION,
  type PricingContext,
} from "../engine/types";
import { resolveCategoryLayer } from "./category-policy-resolver";
import { resolveCompanyLayer } from "./company-policy-resolver";
import { mergePolicies } from "./policy-merge-resolver";
import { resolvePriceList } from "./price-list-resolver";
import { resolveProductLayer } from "./product-policy-resolver";
import {
  RESOLUTION_VERSION,
  RESOLVER_VERSION,
  type PolicyResolution,
  type PricingContextInput,
  type ResolverWarning,
} from "./types";

export interface PricingContextBundle {
  readonly context: PricingContext;
  readonly resolution: PolicyResolution;
}

export function buildPricingContext(
  input: PricingContextInput,
): PricingContextBundle {
  const warnings: ResolverWarning[] = [];

  // ─── Currency ─────────────────────────────────────────────────────────────
  const currency = input.currency ?? input.company.currency;

  // ─── Camadas ──────────────────────────────────────────────────────────────
  const company = resolveCompanyLayer(input.company);
  const category = resolveCategoryLayer(input.category);
  const product = resolveProductLayer(input.product);
  warnings.push(...company.warnings, ...category.warnings, ...product.warnings);

  // ─── Merge campo-a-campo ──────────────────────────────────────────────────
  const merge = mergePolicies({
    company,
    category,
    product,
    contextOverrides: input.contextOverrides,
  });
  warnings.push(...merge.warnings);

  // ─── PriceList ────────────────────────────────────────────────────────────
  const pl = resolvePriceList({
    candidates: input.priceListCandidates,
    productId: input.product.productId,
    currency,
    quantity: input.quantity,
  });
  warnings.push(...pl.warnings);

  // ─── Sanidade de custo ────────────────────────────────────────────────────
  if (!input.costComposition) {
    warnings.push({
      code: "MISSING_COST_COMPOSITION",
      message: "CostComposition ausente na entrada do resolver.",
      field: "costComposition",
    });
  }

  // ─── Sanidade de imposto ──────────────────────────────────────────────────
  // (TaxQuote é opaco — resolver não recalcula; apenas alerta em mismatch óbvio.)
  if (input.taxQuote && input.channel && input.channel.channelId === "") {
    // reservado para futuras validações — no-op estrutural.
  }

  // ─── PolicySource final (inclui campos não-políticos rastreados) ─────────
  const policySource: Record<string, PolicyResolution["policySource"][string]> = {
    ...merge.policySource,
    currency: input.currency ? "context" : "company",
    priceList: pl.selected ? "context" : "system",
    channel: input.channel ? "context" : "system",
    taxQuote: input.taxQuote ? "context" : "system",
    costComposition: "context",
    priceFloor: product.priceFloorCents !== undefined ? "product" : "system",
  };

  // ─── Efetivos aplicáveis do merge ────────────────────────────────────────
  const m = merge.merged;

  // ─── Company defaults efetivos (com overrides de camadas) ─────────────────
  const effectiveDefaults = {
    minMarginPct: m.minMarginPct ?? company.defaults.minMarginPct,
    idealMarginPct: m.idealMarginPct ?? company.defaults.idealMarginPct,
    premiumMarginPct: m.premiumMarginPct ?? company.defaults.premiumMarginPct,
  };

  // ─── Monta PricingContext (contrato do Core) ─────────────────────────────
  const context: PricingContext = {
    contextVersion: CONTEXT_VERSION,
    company: {
      id: input.company.companyId,
      currency,
      defaults: effectiveDefaults,
    },
    category: input.category
      ? { id: input.category.categoryId, name: input.category.name }
      : undefined,
    product: {
      id: product.productId,
      sku: product.sku,
      priceFloorCents: product.priceFloorCents,
    },
    channel: input.channel,
    customerSegment: input.customerSegment,
    quantity: input.quantity,
    store: input.store,
    currency,
    clock: input.clock,
    taxQuote: input.taxQuote,
    priceList: pl.selected,
    costComposition: input.costComposition,
    marginTarget: m.marginTarget,
    commercialBehavior: m.commercialBehavior,
    roundingPolicy: m.roundingPolicy,
    requestId: input.requestId,
    requestedBy: input.requestedBy,
  };

  const resolution: PolicyResolution = {
    resolverVersion: RESOLVER_VERSION,
    resolutionVersion: RESOLUTION_VERSION,
    policySource,
    appliedRules: merge.appliedRules,
    warnings,
    pricingMode: pl.mode,
  };

  return { context, resolution };
}
