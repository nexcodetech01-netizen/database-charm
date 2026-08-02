/**
 * Policy Resolver — API pública
 * =============================
 *
 * Exporta EXCLUSIVAMENTE o que o mundo externo precisa para montar um
 * `PricingContext` sem tocar no Core.
 *
 * O Core (`compute` / `explain`) continua sendo consumido diretamente
 * de `@/features/pricing/engine`.
 */

export { buildPricingContext } from "./pricing-context-factory";
export type { PricingContextBundle } from "./pricing-context-factory";

export { resolveCompanyLayer } from "./company-policy-resolver";
export type { CompanyLayer } from "./company-policy-resolver";

export { resolveCategoryLayer } from "./category-policy-resolver";
export type { CategoryLayer } from "./category-policy-resolver";

export { resolveProductLayer } from "./product-policy-resolver";
export type { ProductLayer } from "./product-policy-resolver";

export { mergePolicies } from "./policy-merge-resolver";
export type { MergeResult } from "./policy-merge-resolver";

export { resolvePriceList } from "./price-list-resolver";
export type { PriceListResolution } from "./price-list-resolver";

export { RESOLVER_VERSION, RESOLUTION_VERSION } from "./types";

export type {
  CompanyPolicy,
  CategoryPolicy,
  ProductPolicy,
  PolicyOverrides,
  PolicyAppliedRule,
  PolicyLayerName,
  PolicyResolution,
  PolicySource,
  PricingContextInput,
  ResolverWarning,
  ResolverWarningCode,
} from "./types";
