/**
 * Motor puro de cálculo de preços.
 * Sem side-effects, sem I/O — utilizável em qualquer módulo (Produtos,
 * Compras, Vendas, Dashboard, Bella IA).
 */
import type {
  PricingEvaluation,
  PricingInput,
  PricingPolicy,
  PricingResult,
  PricingStatus,
  RoundingMode,
} from "./types";

const clamp = (n: number, min = 0) => (Number.isFinite(n) && n > min ? n : min);
const asNum = (v: number | undefined | null, fallback = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Aplica arredondamento comercial (0,99 / 0,90 / inteiro) */
export function applyRounding(price: number, mode: RoundingMode): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  switch (mode) {
    case "integer":
      return Math.round(price);
    case "end_90": {
      const base = Math.floor(price);
      return base + 0.9;
    }
    case "end_99": {
      const base = Math.floor(price);
      return base + 0.99;
    }
    case "none":
    default:
      return Math.round(price * 100) / 100;
  }
}

/** Custo total unitário */
export function computeCostTotal(input: PricingInput, policy?: PricingPolicy): number {
  const cost = clamp(asNum(input.cost));
  const freight = asNum(input.freight, policy?.avgFreight ?? 0);
  const packaging = asNum(input.packaging, policy?.packaging ?? 0);
  const other = asNum(input.otherCosts, policy?.otherCosts ?? 0);
  const commission = asNum(input.commission, 0);
  return cost + freight + packaging + other + commission;
}

/** Taxa efetiva (%) considerando input + política default */
export function resolveFeePct(input: PricingInput, policy: PricingPolicy): number {
  if (typeof input.feePct === "number" && Number.isFinite(input.feePct)) return input.feePct;
  if (policy.defaultChannel === "pix") return policy.pixFeePct + policy.commissionPct;
  if (policy.defaultChannel === "card") return policy.cardFeePct + policy.commissionPct;
  return policy.commissionPct;
}

/**
 * Calcula o preço necessário para atingir uma margem-alvo (%) sobre o preço final,
 * já descontando taxas variáveis (% sobre o preço).
 *   price = cost / (1 - (margin + fee) / 100)
 */
export function priceForMargin(costTotal: number, marginPct: number, feePct: number): number {
  const denomPct = 100 - marginPct - feePct;
  if (denomPct <= 0) return Infinity;
  return costTotal / (denomPct / 100);
}

/** Avaliação de um preço já praticado */
export function evaluatePrice(
  price: number,
  input: PricingInput,
  policy: PricingPolicy,
): PricingEvaluation {
  const costTotal = computeCostTotal(input, policy);
  const feePct = resolveFeePct(input, policy);
  const netPrice = price * (1 - feePct / 100);
  const profit = netPrice - costTotal;
  const marginPct = price > 0 ? (profit / price) * 100 : 0;
  const markupPct = costTotal > 0 ? (profit / costTotal) * 100 : 0;

  let status: PricingStatus = "below";
  if (marginPct >= policy.premiumMargin) status = "premium";
  else if (marginPct >= policy.idealMargin) status = "healthy";
  else if (marginPct >= policy.minMargin) status = "attention";

  const label =
    status === "premium"
      ? "Margem premium"
      : status === "healthy"
        ? "Margem saudável"
        : status === "attention"
          ? "Atenção — abaixo do ideal"
          : "Abaixo da política mínima";

  return { status, label, marginPct, markupPct, profit, costTotal, feePct };
}

/** Cálculo completo — todos os pontos de preço da política */
export function computePricing(input: PricingInput, policy: PricingPolicy): PricingResult {
  const costTotal = computeCostTotal(input, policy);
  const feePct = resolveFeePct(input, policy);

  const target = typeof input.targetMargin === "number" ? input.targetMargin : policy.idealMargin;

  const rawMin = priceForMargin(costTotal, policy.minMargin, feePct);
  const rawRec = priceForMargin(costTotal, policy.idealMargin, feePct);
  const rawPrem = priceForMargin(costTotal, policy.premiumMargin, feePct);
  const rawTarget = priceForMargin(costTotal, target, feePct);

  const minPrice = applyRounding(rawMin, policy.rounding);
  const recommendedPrice = applyRounding(rawRec, policy.rounding);
  const premiumPrice = applyRounding(rawPrem, policy.rounding);
  const targetPrice = applyRounding(rawTarget, policy.rounding);

  const netTarget = targetPrice * (1 - feePct / 100);
  const profit = netTarget - costTotal;
  const marginPct = targetPrice > 0 ? (profit / targetPrice) * 100 : 0;
  const markupPct = costTotal > 0 ? (profit / costTotal) * 100 : 0;

  return {
    costTotal,
    feePct,
    minPrice,
    recommendedPrice,
    premiumPrice,
    targetPrice,
    profit,
    marginPct,
    markupPct,
  };
}
