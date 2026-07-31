/**
 * ProductPolicyResolver — normaliza a camada Produto.
 * PURO. Emite warnings; nunca lança. Produto é a camada de MAIOR prioridade.
 */
import type { PolicyOverrides, ProductPolicy, ResolverWarning } from "./types";

export interface ProductLayer {
  readonly overrides: Readonly<PolicyOverrides>;
  readonly warnings: readonly ResolverWarning[];
  readonly productId: string;
  readonly sku?: string;
  readonly priceFloorCents?: number;
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export function resolveProductLayer(policy: ProductPolicy): ProductLayer {
  const overrides: PolicyOverrides = {
    marginTarget: policy.marginTarget,
    commercialBehavior: policy.commercialBehavior,
    roundingPolicy: policy.roundingPolicy,
    minMarginPct: isNum(policy.minMarginPct) ? policy.minMarginPct : undefined,
    idealMarginPct: isNum(policy.idealMarginPct) ? policy.idealMarginPct : undefined,
    premiumMarginPct: isNum(policy.premiumMarginPct) ? policy.premiumMarginPct : undefined,
  };
  return {
    overrides,
    warnings: [],
    productId: policy.productId,
    sku: policy.sku,
    priceFloorCents: isNum(policy.priceFloorCents) && policy.priceFloorCents >= 0
      ? policy.priceFloorCents
      : undefined,
  };
}
