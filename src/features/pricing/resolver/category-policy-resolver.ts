/**
 * CategoryPolicyResolver — normaliza a camada Categoria.
 * PURO. Emite warnings; nunca lança.
 */
import type { CategoryPolicy, PolicyOverrides, ResolverWarning } from "./types";

export interface CategoryLayer {
  readonly overrides: Readonly<PolicyOverrides>;
  readonly warnings: readonly ResolverWarning[];
  readonly categoryId?: string;
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export function resolveCategoryLayer(
  policy: CategoryPolicy | undefined,
): CategoryLayer {
  if (!policy) {
    return { overrides: {}, warnings: [] };
  }
  const overrides: PolicyOverrides = {
    marginTarget: policy.marginTarget,
    commercialBehavior: policy.commercialBehavior,
    roundingPolicy: policy.roundingPolicy,
    minMarginPct: isNum(policy.minMarginPct) ? policy.minMarginPct : undefined,
    idealMarginPct: isNum(policy.idealMarginPct) ? policy.idealMarginPct : undefined,
    premiumMarginPct: isNum(policy.premiumMarginPct) ? policy.premiumMarginPct : undefined,
  };
  return { overrides, warnings: [], categoryId: policy.categoryId };
}
