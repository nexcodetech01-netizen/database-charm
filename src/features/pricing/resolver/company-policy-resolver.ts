/**
 * CompanyPolicyResolver — normaliza a camada Empresa.
 * PURO. Não faz I/O. Emite warnings; nunca lança.
 */
import type {
  CompanyPolicy,
  PolicyOverrides,
  ResolverWarning,
} from "./types";

export interface CompanyLayer {
  readonly overrides: Readonly<PolicyOverrides>;
  readonly defaults: {
    minMarginPct: number;
    idealMarginPct: number;
    premiumMarginPct: number;
  };
  readonly warnings: readonly ResolverWarning[];
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export function resolveCompanyLayer(policy: CompanyPolicy): CompanyLayer {
  const warnings: ResolverWarning[] = [];

  const d = policy.defaults ?? {};
  if (
    !isNum(d.minMarginPct) ||
    !isNum(d.idealMarginPct) ||
    !isNum(d.premiumMarginPct)
  ) {
    warnings.push({
      code: "MISSING_COMPANY_DEFAULTS",
      message:
        "Empresa sem defaults de margem completos (min/ideal/premium). Assumindo 0/0/0.",
      field: "company.defaults",
      detail: { received: d },
    });
  }

  const defaults = {
    minMarginPct: isNum(d.minMarginPct) ? d.minMarginPct : 0,
    idealMarginPct: isNum(d.idealMarginPct) ? d.idealMarginPct : 0,
    premiumMarginPct: isNum(d.premiumMarginPct) ? d.premiumMarginPct : 0,
  };

  const overrides: PolicyOverrides = {
    marginTarget: policy.marginTarget,
    commercialBehavior: policy.commercialBehavior,
    roundingPolicy: policy.roundingPolicy,
    minMarginPct: isNum(policy.minMarginPct) ? policy.minMarginPct : undefined,
    idealMarginPct: isNum(policy.idealMarginPct) ? policy.idealMarginPct : undefined,
    premiumMarginPct: isNum(policy.premiumMarginPct) ? policy.premiumMarginPct : undefined,
  };

  return { overrides, defaults, warnings };
}
