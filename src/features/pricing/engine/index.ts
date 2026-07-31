/**
 * Pricing Engine — API pública (Core, Fase P1)
 * ============================================
 *
 * Exporta EXCLUSIVAMENTE:
 *   - compute(context)  → PricingResult
 *   - explain(result)   → PricingExplanation
 *   - Contratos versionados (tipos)
 *   - Constantes de versão
 *
 * NÃO exporta:
 *   - resolvePolicy, applyChannel, applyStrategy, round, evaluate, composeCost
 *   - Utilitários internos (math, rounding, validators)
 *
 * Motor puro. Zero I/O. Não conhece React, Supabase, banco, cache,
 * ou qualquer outro módulo do NexOS.
 */

export { compute } from "./compute";
export { explain } from "./explain";
export {
  composeCostComposition,
  sumCostComponentsCents,
  type CostComponentsInputCents,
} from "./internal/cost";


export {
  ENGINE_VERSION,
  CALCULATION_VERSION,
  CONTEXT_VERSION,
  RESULT_VERSION,
  EXPLANATION_VERSION,
  COST_COMPOSITION_VERSION,
  TAX_QUOTE_VERSION,
  PRICE_LIST_VERSION,
  CHANNEL_CONTRACT_VERSION,
} from "./types";

export type {
  // Contexto
  PricingContext,
  CompanySnapshot,
  CategorySnapshot,
  ProductSnapshot,
  ChannelContract,
  CostComposition,
  TaxQuote,
  PriceListEntry,
  PricingClock,
  FxRate,
  RequestedBy,
  CurrencyCode,
  // Estratégias ortogonais
  MarginTargetSpec,
  CommercialBehaviorSpec,
  RoundingPolicySpec,
  // Resultado
  PricingResult,
  PricingMode,
  PricingStepName,
  AppliedRule,
  PolicySource,
  // Explicação
  PricingExplanation,
  ExplanationStep,
  InvariantCheck,
  // Warnings
  PricingWarning,
  PricingWarningCode,
} from "./types";
