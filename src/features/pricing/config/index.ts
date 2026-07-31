/**
 * Commercial Configuration Domain — barrel público
 * =================================================
 * Camada pura. Zero React, zero Supabase, zero IO.
 * Fonte única de configuração comercial consumida pelo Pricing Engine
 * via `PricingContextFactory` (resolver).
 */
export {
  DomainValidationError,
  okResult,
  toResult,
  throwIfInvalid,
  type DomainIssue,
  type DomainIssueCode,
  type DomainIssueSeverity,
  type ValidationResult,
} from "./errors";

export {
  createMarginTarget,
  validateMarginTarget,
  isMarginTargetSpec,
  type MarginTargetKind,
} from "./margin-target";

export {
  createStandard,
  createHighTurnover,
  createPromotion,
  createStockBurn,
  validateCommercialBehavior,
  type CommercialBehaviorKind,
} from "./commercial-behavior";

export {
  createRoundingNone,
  createRoundingInteger,
  createRoundingEnd90,
  createRoundingEnd99,
  createPsychologicalRounding,
  validateRoundingPolicy,
  type RoundingPolicyKind,
} from "./rounding-policy";

export {
  createCostComposition,
  validateCostComposition,
  type CostComponentsInput,
} from "./cost-components";

export {
  createChannelContract,
  validateChannelContract,
  type ChannelContractInput,
} from "./channel-contract";

export {
  createTaxQuote,
  validateTaxQuote,
  type TaxQuoteInput,
} from "./tax-quote";

export {
  createPriceList,
  createPriceListEntry,
  validatePriceList,
  validatePriceListEntry,
  PRICE_LIST_AGGREGATE_VERSION,
  type PriceListAggregate,
  type PriceListInput,
  type PriceListEntryInput,
  type PriceListScope,
  type PriceListFallback,
} from "./price-list";

export {
  createCompanyPolicy,
  validateCompanyPolicy,
  type CompanyPolicyInput,
} from "./company-policy";

export {
  createCategoryPolicy,
  validateCategoryPolicy,
  type CategoryPolicyInput,
} from "./category-policy";

export {
  createProductPolicy,
  validateProductPolicy,
  type ProductPolicyInput,
} from "./product-policy";

export {
  CONFIG_DOMAIN_VERSION,
  toEnvelope,
  toJSON,
  fromEnvelope,
  fromJSON,
  type ConfigEnvelope,
  type ParseOptions,
  type SupportedPayloadKind,
} from "./serialization";
