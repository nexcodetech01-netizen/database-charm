/**
 * ProductPolicy — factory + validador
 * ===================================
 * Camada mais alta na hierarquia (ADR-006). Carrega piso absoluto de preço.
 */
import type { ProductPolicy } from "../resolver/types";
import type { DomainIssue } from "./errors";
import { validateCommercialBehavior } from "./commercial-behavior";
import { validateMarginTarget } from "./margin-target";
import {
  issue,
  isFiniteNumber,
  validateCents,
  validatePct,
  validateRequiredString,
} from "./primitives";
import { validateRoundingPolicy } from "./rounding-policy";

export interface ProductPolicyInput {
  productId: string;
  sku?: string;
  priceFloorCents?: number;
  marginTarget?: ProductPolicy["marginTarget"];
  commercialBehavior?: ProductPolicy["commercialBehavior"];
  roundingPolicy?: ProductPolicy["roundingPolicy"];
  minMarginPct?: number;
  idealMarginPct?: number;
  premiumMarginPct?: number;
}

export function createProductPolicy(input: ProductPolicyInput): ProductPolicy {
  return {
    productId: input.productId,
    sku: input.sku,
    priceFloorCents: input.priceFloorCents,
    marginTarget: input.marginTarget,
    commercialBehavior: input.commercialBehavior,
    roundingPolicy: input.roundingPolicy,
    minMarginPct: input.minMarginPct,
    idealMarginPct: input.idealMarginPct,
    premiumMarginPct: input.premiumMarginPct,
  };
}

export function validateProductPolicy(
  value: unknown,
  path = "productPolicy",
): DomainIssue[] {
  if (value === null || typeof value !== "object") {
    return [issue("INVALID_TYPE", path, `${path} deve ser objeto`)];
  }
  const p = value as Record<string, unknown>;
  const issues: DomainIssue[] = [];

  issues.push(...validateRequiredString(p.productId, `${path}.productId`));

  if (p.priceFloorCents !== undefined) {
    issues.push(...validateCents(p.priceFloorCents, `${path}.priceFloorCents`));
  }

  for (const field of ["minMarginPct", "idealMarginPct", "premiumMarginPct"] as const) {
    if (p[field] !== undefined) {
      issues.push(...validatePct(p[field], `${path}.${field}`, { min: -100, max: 100 }));
    }
  }

  const min = p.minMarginPct;
  const ideal = p.idealMarginPct;
  const premium = p.premiumMarginPct;
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

  issues.push(...validateMarginTarget(p.marginTarget, `${path}.marginTarget`));
  issues.push(...validateCommercialBehavior(p.commercialBehavior, `${path}.commercialBehavior`));
  issues.push(...validateRoundingPolicy(p.roundingPolicy, `${path}.roundingPolicy`));

  return issues;
}
