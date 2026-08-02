/**
 * Pricing Application Layer — public API
 * ======================================
 * Camada de casos de uso do domínio de Precificação.
 *
 * Regras:
 *   - NÃO importa React, Supabase ou HTTP.
 *   - Depende apenas de PORTAS (`ports.ts`) implementadas por adaptadores.
 *   - Cada Use Case tem UMA responsabilidade.
 *   - Erros externos são traduzidos em `ApplicationError`.
 */

export { APPLICATION_VERSION } from "./ports";
export type {
  Actor,
  ClockPort,
  HasherPort,
  IdGeneratorPort,
  PricingApplicationDeps,
  PricingEnginePort,
  PricingResolverPort,
  UseCase,
} from "./ports";

export {
  ApplicationError,
  invalidArgument,
  notFound,
  validationFailed,
  type ApplicationErrorCode,
} from "./errors";

export {
  defaultEngine,
  defaultHasher,
  defaultResolver,
  systemClock,
  createIdGenerator,
} from "./adapters";

// Company
export {
  createCreateCompanyPolicyUseCase,
  type CreateCompanyPolicyInput,
  type CreateCompanyPolicyOutput,
} from "./use-cases/create-company-policy";
export {
  createUpdateCompanyPolicyUseCase,
  type UpdateCompanyPolicyInput,
  type UpdateCompanyPolicyOutput,
} from "./use-cases/update-company-policy";

// Category
export {
  createCreateCategoryPolicyUseCase,
  createUpdateCategoryPolicyUseCase,
  type CreateCategoryPolicyInput,
  type UpdateCategoryPolicyInput,
  type CategoryPolicyOutput,
} from "./use-cases/category-policy";

// Product
export {
  createCreateProductPolicyUseCase,
  createUpdateProductPolicyUseCase,
  type CreateProductPolicyInput,
  type UpdateProductPolicyInput,
  type ProductPolicyOutput,
} from "./use-cases/product-policy";

// PriceList
export {
  createCreatePriceListUseCase,
  createUpdatePriceListUseCase,
  createActivatePriceListUseCase,
  createDeactivatePriceListUseCase,
  type CreatePriceListInput,
  type UpdatePriceListInput,
  type TogglePriceListInput,
  type PriceListOutput,
} from "./use-cases/price-list";

// Pricing
export { createResolvePricingUseCase, type ResolvePricingInput } from "./use-cases/resolve-pricing";
export {
  createCalculateSuggestedPriceUseCase,
  type CalculateSuggestedPriceInput,
  type CalculateSuggestedPriceOutput,
} from "./use-cases/calculate-suggested-price";
export {
  createApplySuggestedPriceUseCase,
  type ApplySuggestedPriceInput,
  type ApplySuggestedPriceOutput,
  type ApplyPriceCommand,
  type PriceStrategy,
} from "./use-cases/apply-suggested-price";
export {
  createRegisterPricingDecisionUseCase,
  type RegisterPricingDecisionInput,
} from "./use-cases/register-pricing-decision";
