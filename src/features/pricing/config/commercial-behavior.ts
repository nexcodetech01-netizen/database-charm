/**
 * CommercialBehavior — factory + validador
 * ========================================
 */
import type { CommercialBehaviorSpec } from "../engine/types";
import type { DomainIssue } from "./errors";
import { issue, validatePct } from "./primitives";

export type CommercialBehaviorKind = CommercialBehaviorSpec["kind"];

const VALID_KINDS: readonly CommercialBehaviorKind[] = [
  "standard",
  "high_turnover",
  "promotion",
  "stock_burn",
];

export function createStandard(): CommercialBehaviorSpec {
  return { kind: "standard" };
}
export function createHighTurnover(discountPct?: number): CommercialBehaviorSpec {
  if (discountPct !== undefined && !Number.isFinite(discountPct)) {
    throw new Error("createHighTurnover: discountPct deve ser finito");
  }
  return { kind: "high_turnover", discountPct };
}
export function createPromotion(discountPct: number): CommercialBehaviorSpec {
  if (!Number.isFinite(discountPct)) {
    throw new Error("createPromotion: discountPct deve ser finito");
  }
  return { kind: "promotion", discountPct };
}
export function createStockBurn(maxDiscountPct: number): CommercialBehaviorSpec {
  if (!Number.isFinite(maxDiscountPct)) {
    throw new Error("createStockBurn: maxDiscountPct deve ser finito");
  }
  return { kind: "stock_burn", maxDiscountPct };
}

export function validateCommercialBehavior(
  value: unknown,
  path = "commercialBehavior",
): DomainIssue[] {
  if (value === undefined || value === null) return [];
  if (typeof value !== "object") {
    return [issue("INVALID_TYPE", path, `${path} deve ser objeto`)];
  }
  const spec = value as {
    kind?: unknown;
    discountPct?: unknown;
    maxDiscountPct?: unknown;
  };
  if (
    typeof spec.kind !== "string" ||
    !VALID_KINDS.includes(spec.kind as CommercialBehaviorKind)
  ) {
    return [
      issue(
        "INVALID_COMMERCIAL_BEHAVIOR",
        `${path}.kind`,
        `commercialBehavior.kind inválido`,
        { expected: VALID_KINDS, actual: spec.kind },
      ),
    ];
  }
  const issues: DomainIssue[] = [];
  if (spec.kind === "high_turnover" && spec.discountPct !== undefined) {
    issues.push(...validatePct(spec.discountPct, `${path}.discountPct`, { min: 0, max: 100 }));
  }
  if (spec.kind === "promotion") {
    issues.push(...validatePct(spec.discountPct, `${path}.discountPct`, { min: 0, max: 100 }));
  }
  if (spec.kind === "stock_burn") {
    issues.push(...validatePct(spec.maxDiscountPct, `${path}.maxDiscountPct`, { min: 0, max: 100 }));
  }
  return issues;
}
