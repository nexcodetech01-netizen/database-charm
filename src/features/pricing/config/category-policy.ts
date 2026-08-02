/**
 * CategoryPolicy — factory + validador
 * ====================================
 */
import type { CategoryPolicy } from "../resolver/types";
import type { DomainIssue } from "./errors";
import { validateCommercialBehavior } from "./commercial-behavior";
import { validateMarginTarget } from "./margin-target";
import { issue, isFiniteNumber, validatePct, validateRequiredString } from "./primitives";
import { validateRoundingPolicy } from "./rounding-policy";

export interface CategoryPolicyInput {
  categoryId: string;
  name?: string;
  marginTarget?: CategoryPolicy["marginTarget"];
  commercialBehavior?: CategoryPolicy["commercialBehavior"];
  roundingPolicy?: CategoryPolicy["roundingPolicy"];
  minMarginPct?: number;
  idealMarginPct?: number;
  premiumMarginPct?: number;
}

export function createCategoryPolicy(input: CategoryPolicyInput): CategoryPolicy {
  return {
    categoryId: input.categoryId,
    name: input.name,
    marginTarget: input.marginTarget,
    commercialBehavior: input.commercialBehavior,
    roundingPolicy: input.roundingPolicy,
    minMarginPct: input.minMarginPct,
    idealMarginPct: input.idealMarginPct,
    premiumMarginPct: input.premiumMarginPct,
  };
}

export function validateCategoryPolicy(value: unknown, path = "categoryPolicy"): DomainIssue[] {
  if (value === null || typeof value !== "object") {
    return [issue("INVALID_TYPE", path, `${path} deve ser objeto`)];
  }
  const c = value as Record<string, unknown>;
  const issues: DomainIssue[] = [];

  issues.push(...validateRequiredString(c.categoryId, `${path}.categoryId`));

  for (const field of ["minMarginPct", "idealMarginPct", "premiumMarginPct"] as const) {
    if (c[field] !== undefined) {
      issues.push(...validatePct(c[field], `${path}.${field}`, { min: -100, max: 100 }));
    }
  }

  const min = c.minMarginPct;
  const ideal = c.idealMarginPct;
  const premium = c.premiumMarginPct;
  if (isFiniteNumber(min) && isFiniteNumber(ideal) && min > ideal) {
    issues.push(
      issue("MARGIN_INCONSISTENT", `${path}.idealMarginPct`, `min > ideal`, { min, ideal }),
    );
  }
  if (isFiniteNumber(ideal) && isFiniteNumber(premium) && ideal > premium) {
    issues.push(
      issue("MARGIN_INCONSISTENT", `${path}.premiumMarginPct`, `ideal > premium`, {
        ideal,
        premium,
      }),
    );
  }

  issues.push(...validateMarginTarget(c.marginTarget, `${path}.marginTarget`));
  issues.push(...validateCommercialBehavior(c.commercialBehavior, `${path}.commercialBehavior`));
  issues.push(...validateRoundingPolicy(c.roundingPolicy, `${path}.roundingPolicy`));

  return issues;
}
