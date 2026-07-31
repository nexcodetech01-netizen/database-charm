/**
 * Pricing Engine — Core Types (v1)
 * =================================
 *
 * Contratos versionados, congelados na Sprint A0.1.
 * Referências normativas:
 *   - docs/INTELIGENCIA_COMERCIAL.md §17–§29
 *   - docs/architecture/ADR-001..010
 *
 * Este arquivo é PURO. Zero dependências externas.
 * Não importa React, Supabase, tanstack, lib de datas ou qualquer coisa fora
 * do próprio domínio.
 */

// -----------------------------------------------------------------------------
// Versões (ADR-008)
// -----------------------------------------------------------------------------

export const ENGINE_VERSION = "pricing-engine/1.0.0" as const;
export const CALCULATION_VERSION = "calc/2026-07-A" as const;
export const CONTEXT_VERSION = "pricing-context/1" as const;
export const RESULT_VERSION = "pricing-result/1" as const;
export const EXPLANATION_VERSION = "pricing-explanation/1" as const;
export const COST_COMPOSITION_VERSION = "cost-composition/1" as const;
export const TAX_QUOTE_VERSION = "tax-quote/1" as const;
export const PRICE_LIST_VERSION = "price-list/1" as const;
export const CHANNEL_CONTRACT_VERSION = "channel-contract/1" as const;

// -----------------------------------------------------------------------------
// Vocabulário de warnings (§29 — vocabulário fechado, versionado)
// -----------------------------------------------------------------------------

export type PricingWarningCode =
  | "COST_STALE"
  | "COST_MISSING"
  | "INSUFFICIENT_COST_DATA"
  | "COST_COMPONENTS_MISMATCH"
  | "TAX_QUOTE_MISSING"
  | "TAX_QUOTE_EXPIRED"
  | "TABLED_PRICE_BELOW_FLOOR"
  | "MARGIN_BELOW_MIN"
  | "MARGIN_BELOW_IDEAL"
  | "NON_LINEAR_CHANNEL_RULE_IGNORED"
  | "PRICE_LIST_FALLBACK_APPLIED"
  | "POLICY_CONTRADICTION"
  | "PSYCHOLOGICAL_ROUNDING_INFLATED_MARGIN"
  // Warnings estruturais do Core (validação de contexto):
  | "NEGATIVE_COST"
  | "INVALID_MARGIN_TARGET"
  | "INVALID_QUANTITY"
  | "INVALID_ROUNDING_POLICY"
  | "DIVISION_BY_ZERO_AVOIDED"
  | "NEGATIVE_PRICE_CLAMPED"
  | "MISSING_COST_COMPOSITION";


export interface PricingWarning {
  code: PricingWarningCode;
  message: string;
  /** Passo do cálculo em que o warning foi emitido. */
  step?: PricingStepName;
  /** Detalhes opcionais para debug/UI. */
  detail?: Readonly<Record<string, unknown>>;
}

// -----------------------------------------------------------------------------
// Estratégias ortogonais (§22 — ADR-001)
// -----------------------------------------------------------------------------

export type MarginTargetSpec =
  | { kind: "min" }
  | { kind: "ideal" }
  | { kind: "premium" }
  | { kind: "custom"; pct: number };

export type CommercialBehaviorSpec =
  | { kind: "standard" }
  | { kind: "high_turnover"; discountPct?: number }
  | { kind: "promotion"; discountPct: number }
  | { kind: "stock_burn"; maxDiscountPct: number };

export type RoundingPolicySpec =
  | { kind: "none" }
  | { kind: "integer" }
  | { kind: "end_90" }
  | { kind: "end_99" }
  | { kind: "psychological"; endings: readonly number[] };

// -----------------------------------------------------------------------------
// Snapshots (contexto imutável — §21)
// -----------------------------------------------------------------------------

export interface CompanySnapshot {
  id: string;
  currency: CurrencyCode;
  /** Margens-piso globais em %. Usadas como fallback do MarginTarget. */
  defaults?: {
    minMarginPct?: number;
    idealMarginPct?: number;
    premiumMarginPct?: number;
  };
}

export interface CategorySnapshot {
  id: string;
  name?: string;
}

export interface ProductSnapshot {
  id: string;
  sku?: string;
  /** Piso absoluto (em centavos). Nenhum preço pode ser menor. */
  priceFloorCents?: number;
}

/** ChannelContract.v1 — §20 (Sales injeta, Pricing consome). */
export interface ChannelContract {
  channelId: string;
  variableFeePct: number;
  fixedFeePerOrderCents: number;
  operationalCostCents: number;
  minMarginOverridePct?: number;
  /** Regras não-lineares são declarativas — Core Engine emite warning e ignora. */
  hasNonLinearRules?: boolean;
  version: typeof CHANNEL_CONTRACT_VERSION;
}

/** CostComposition.v1 — §26 (Inventory produz). */
export interface CostComposition {
  version: typeof COST_COMPOSITION_VERSION;
  /** Custo unitário composto final, em centavos. Fonte da verdade para margem. */
  perUnitCostCents: number;
  weightedAverageCostCents?: number;
  acquisitionCostCents?: number;
  freightCents?: number;
  insuranceCents?: number;
  packagingCents?: number;
  otherExpensesCents?: number;
  /** ISO-8601 do momento em que o custo foi estabilizado. */
  computedAt: string;
  staleThresholdDays?: number;
  origin?: "inventory" | "purchase" | "manual";
}

/** TaxQuote.v1 — §19 (Tax Engine produz). */
export interface TaxQuote {
  version: typeof TAX_QUOTE_VERSION;
  quoteId: string;
  totalPctOnPrice: number;
  totalFixedCents: number;
  validFrom?: string;
  validTo?: string;
  taxEngineVersion: string;
}

/** PriceList.v1 — §23 (modo tabelado). Apenas a entry aplicável chega ao Core. */
export interface PriceListEntry {
  version: typeof PRICE_LIST_VERSION;
  priceListId: string;
  productId: string;
  priceCents: number;
  currency: CurrencyCode;
  minQty?: number;
  maxQty?: number;
  fallback: "derived" | "reject";
  priority?: number;
}

// -----------------------------------------------------------------------------
// PricingContext.v1 (CONGELADO — §21, ADR-004)
// -----------------------------------------------------------------------------

export type CurrencyCode = "BRL" | string;

export interface PricingClock {
  /** ISO-8601. Injetado — motor jamais lê Date.now. */
  now: string;
  tz?: string;
}

export interface FxRate {
  base: CurrencyCode;
  quote: CurrencyCode;
  rate: number;
}

export interface RequestedBy {
  module: string;
  userId?: string;
}

export interface PricingContext {
  readonly contextVersion: typeof CONTEXT_VERSION;

  readonly company: CompanySnapshot;
  readonly category?: CategorySnapshot;
  readonly product: ProductSnapshot;
  readonly channel?: ChannelContract;
  readonly customerSegment?: { id: string; tier?: string };
  readonly quantity: number;
  readonly store?: { id: string; region?: string };
  readonly currency: CurrencyCode;
  readonly clock: PricingClock;
  readonly taxQuote?: TaxQuote;
  readonly priceList?: PriceListEntry;
  readonly fxRate?: FxRate;
  readonly costComposition: CostComposition;

  readonly marginTarget?: MarginTargetSpec;
  readonly commercialBehavior?: CommercialBehaviorSpec;
  readonly roundingPolicy?: RoundingPolicySpec;

  readonly requestId: string;
  readonly requestedBy: RequestedBy;
}

// -----------------------------------------------------------------------------
// PricingResult.v1 (§24)
// -----------------------------------------------------------------------------

export type PricingMode = "derived" | "tabled";

export type PricingStepName =
  | "cost"
  | "target"
  | "behavior"
  | "channel"
  | "tax"
  | "pricelist"
  | "rounding"
  | "floor";

/** Item determinístico da trilha de cálculo. */
export interface AppliedRule {
  step: PricingStepName;
  /** Rótulo curto e estável (contrato — ADR-005). */
  rule: string;
  /** Preço/valor de entrada do passo, em centavos (quando aplicável). */
  inputCents?: number;
  /** Preço/valor de saída do passo, em centavos (quando aplicável). */
  outputCents?: number;
  /** Origem do dado (ex.: "company", "category", "product", "channel", "system"). */
  source?: string;
  /** Detalhes livres, apenas informativos. */
  detail?: Readonly<Record<string, unknown>>;
}

/** Origem de cada atributo resolvido (§24). Fase 1: `Core` recebe já resolvido. */
export type PolicySource = Readonly<Record<string, string>>;

export interface PricingResult {
  readonly resultVersion: typeof RESULT_VERSION;
  readonly mode: PricingMode;

  // Preços — SEMPRE em centavos. Formatação humana é responsabilidade da borda.
  readonly minPriceCents: number;
  readonly recommendedPriceCents: number;
  readonly premiumPriceCents: number;
  readonly targetPriceCents: number;
  readonly finalPriceCents: number;

  // Indicadores
  readonly costTotalCents: number;
  readonly grossProfitCents: number;
  readonly netProfitCents: number;
  /** Margem líquida sobre preço final (%). */
  readonly marginPct: number;
  /** Markup sobre custo total (%). */
  readonly markupPct: number;

  // Trilha de cálculo (ordem determinística — §24)
  readonly appliedRules: readonly AppliedRule[];
  readonly policySource: PolicySource;

  // Versionamento (ADR-008)
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly calculationVersion: typeof CALCULATION_VERSION;
  readonly policyVersion: string;
  readonly contextVersion: typeof CONTEXT_VERSION;
  readonly taxEngineVersion?: string;

  // Rastreabilidade
  readonly requestId: string;
  readonly explainId: string;
  readonly computedAt: string;
  readonly currency: CurrencyCode;
  readonly warnings: readonly PricingWarning[];
}

// -----------------------------------------------------------------------------
// PricingExplanation.v1 (§25)
// -----------------------------------------------------------------------------

export interface ExplanationStep {
  readonly step: PricingStepName;
  readonly rule: string;
  readonly source?: string;
  readonly inputCents?: number;
  readonly outputCents?: number;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface InvariantCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

export interface PricingExplanation {
  readonly explanationVersion: typeof EXPLANATION_VERSION;
  readonly explainId: string;
  readonly requestId: string;
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly calculationVersion: typeof CALCULATION_VERSION;
  readonly policyVersion: string;
  readonly mode: PricingMode;

  /** Texto livre — pode mudar entre versões. Não é contrato. */
  readonly summary: string;
  /** Contrato estável (espelha appliedRules). */
  readonly steps: readonly ExplanationStep[];
  readonly policyResolutionTree: PolicySource;
  readonly invariantsChecked: readonly InvariantCheck[];
  readonly warnings: readonly PricingWarning[];
  readonly suggestedActions?: readonly string[];
}
