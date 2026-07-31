/**
 * MarginTarget — factory + validador
 * ==================================
 * Wrapper de domínio sobre `MarginTargetSpec` (Core, congelado).
 */
import type { MarginTargetSpec } from "../engine/types";
import type { DomainIssue } from "./errors";
import { issue, validatePct } from "./primitives";

export type MarginTargetKind = MarginTargetSpec["kind"];

const VALID_KINDS: readonly MarginTargetKind[] = [
  "min",
  "ideal",
  "premium",
  "custom",
];

export function createMarginTarget(
  kind: "min" | "ideal" | "premium",
): MarginTargetSpec;
export function createMarginTarget(kind: "custom", pct: number): MarginTargetSpec;
export function createMarginTarget(
  kind: MarginTargetKind,
  pct?: number,
): MarginTargetSpec {
  if (kind === "custom") {
    if (typeof pct !== "number" || !Number.isFinite(pct)) {
      throw new Error("createMarginTarget: 'custom' requer pct numérico finito");
    }
    return { kind, pct };
  }
  return { kind };
}

export function validateMarginTarget(
  value: unknown,
  path = "marginTarget",
): DomainIssue[] {
  if (value === undefined || value === null) return [];
  if (typeof value !== "object") {
    return [issue("INVALID_TYPE", path, `${path} deve ser objeto`)];
  }
  const spec = value as { kind?: unknown; pct?: unknown };
  if (typeof spec.kind !== "string" || !VALID_KINDS.includes(spec.kind as MarginTargetKind)) {
    return [
      issue("INVALID_ENUM", `${path}.kind`, `kind inválido`, {
        expected: VALID_KINDS,
        actual: spec.kind,
      }),
    ];
  }
  if (spec.kind === "custom") {
    return validatePct(spec.pct, `${path}.pct`, { min: -100, max: 100 });
  }
  return [];
}

export function isMarginTargetSpec(value: unknown): value is MarginTargetSpec {
  return validateMarginTarget(value).length === 0 && value != null;
}
