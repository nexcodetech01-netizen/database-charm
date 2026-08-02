/**
 * Motor Comercial Oficial — barrel.
 * ÚNICA superfície pública de cálculo de preço do NexOS.
 */
export {
  computeOfficialPricing,
  evaluateOfficialPrice,
  type OfficialPricing,
  type OfficialPricingInput,
  type OfficialEvaluation,
  type OfficialCostInput,
  type OfficialMarginInput,
  type OfficialFeeInput,
  type PriceAuditLine,
} from "./official-pricing";

export {
  buildFeeTable,
  resolveFee,
  worstCaseFee,
  worstCaseCreditFee,
  creditFeeLadder,
  effectiveFeePct,
  allowedInstallments,
  maxInstallmentsForAmount,
  INSTALLMENT_MIN_AMOUNT,
  MAX_INSTALLMENTS_NO_INTEREST,
  EMPTY_FEE_TABLE,
  NO_FEE,
  type CompanyFeeTable,
  type FeeRate,
  type ResolvedFee,
} from "./fees";

export {
  evaluatePriceGuards,
  hasBlockingGuard,
  type PriceGuard,
  type PriceGuardCode,
  type PriceGuardPolicy,
  type PriceGuardSeverity,
} from "./guards";
