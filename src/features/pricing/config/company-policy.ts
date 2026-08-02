/**
 * CompanyPolicy — factory + validador
 * ===================================
 * Camada mais externa da hierarquia (ADR-006).
 * Faz a validação de coerência de margens (min ≤ ideal ≤ premium).
 */
import type { CompanyPolicy } from "../resolver/types";
import type { DomainIssue } from "./errors";
import { validateCommercialBehavior } from "./commercial-behavior";
import { validateMarginTarget } from "./margin-target";
import {
  issue,
  isFiniteNumber,
  validateCurrency,
  validatePct,
  validateRequiredString,
} from "./primitives";
import { validateRoundingPolicy } from "./rounding-policy";

export interface CompanyPolicyInput {
  companyId: string;
  currency: string;
  defaults?: {
    minMarginPct?: number;
    idealMarginPct?: number;
    premiumMarginPct?: number;
  };
  marginTarget?: CompanyPolicy["marginTarget"];
  commercialBehavior?: CompanyPolicy["commercialBehavior"];
  roundingPolicy?: CompanyPolicy["roundingPolicy"];
  minMarginPct?: number;
  idealMarginPct?: number;
  premiumMarginPct?: number;
}

export function createCompanyPolicy(input: CompanyPolicyInput): CompanyPolicy {
  return {
    companyId: input.companyId,
    currency: input.currency,
    defaults: input.defaults,
    marginTarget: input.marginTarget,
    commercialBehavior: input.commercialBehavior,
    roundingPolicy: input.roundingPolicy,
    minMarginPct: input.minMarginPct,
    idealMarginPct: input.idealMarginPct,
    premiumMarginPct: input.premiumMarginPct,
  };
}

function validateMarginTriplet(
  triplet: { min?: unknown; ideal?: unknown; premium?: unknown },
  basePath: string,
): DomainIssue[] {
  const issues: DomainIssue[] = [];
  const min = triplet.min;
  const ideal = triplet.ideal;
  const premium = triplet.premium;

  if (min !== undefined)
    issues.push(...validatePct(min, `${basePath}.minMarginPct`, { min: -100, max: 100 }));
  if (ideal !== undefined)
    issues.push(...validatePct(ideal, `${basePath}.idealMarginPct`, { min: -100, max: 100 }));
  if (premium !== undefined)
    issues.push(...validatePct(premium, `${basePath}.premiumMarginPct`, { min: -100, max: 100 }));

  if (issues.length === 0 && isFiniteNumber(min) && isFiniteNumber(ideal) && min > ideal) {
    issues.push(
      issue("MARGIN_INCONSISTENT", `${basePath}.idealMarginPct`, `min > ideal`, { min, ideal }),
    );
  }
  if (issues.length === 0 && isFiniteNumber(ideal) && isFiniteNumber(premium) && ideal > premium) {
    issues.push(
      issue("MARGIN_INCONSISTENT", `${basePath}.premiumMarginPct`, `ideal > premium`, {
        ideal,
        premium,
      }),
    );
  }
  return issues;
}

export function validateCompanyPolicy(value: unknown, path = "companyPolicy"): DomainIssue[] {
  if (value === null || typeof value !== "object") {
    return [issue("INVALID_TYPE", path, `${path} deve ser objeto`)];
  }
  const c = value as Record<string, unknown>;
  const issues: DomainIssue[] = [];

  issues.push(...validateRequiredString(c.companyId, `${path}.companyId`));
  issues.push(...validateCurrency(c.currency, `${path}.currency`));

  if (c.defaults !== undefined) {
    if (typeof c.defaults !== "object" || c.defaults === null) {
      issues.push(issue("INVALID_TYPE", `${path}.defaults`, `defaults deve ser objeto`));
    } else {
      const d = c.defaults as Record<string, unknown>;
      issues.push(
        ...validateMarginTriplet(
          { min: d.minMarginPct, ideal: d.idealMarginPct, premium: d.premiumMarginPct },
          `${path}.defaults`,
        ),
      );
    }
  }

  issues.push(
    ...validateMarginTriplet(
      { min: c.minMarginPct, ideal: c.idealMarginPct, premium: c.premiumMarginPct },
      path,
    ),
  );

  issues.push(...validateMarginTarget(c.marginTarget, `${path}.marginTarget`));
  issues.push(...validateCommercialBehavior(c.commercialBehavior, `${path}.commercialBehavior`));
  issues.push(...validateRoundingPolicy(c.roundingPolicy, `${path}.roundingPolicy`));

  return issues;
}
