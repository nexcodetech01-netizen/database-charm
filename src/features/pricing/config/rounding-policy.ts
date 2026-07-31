/**
 * RoundingPolicy — factory + validador
 * ====================================
 */
import type { RoundingPolicySpec } from "../engine/types";
import type { DomainIssue } from "./errors";
import { issue } from "./primitives";

export type RoundingPolicyKind = RoundingPolicySpec["kind"];

const VALID_KINDS: readonly RoundingPolicyKind[] = [
  "none",
  "integer",
  "end_90",
  "end_99",
  "psychological",
];

export function createRoundingNone(): RoundingPolicySpec {
  return { kind: "none" };
}
export function createRoundingInteger(): RoundingPolicySpec {
  return { kind: "integer" };
}
export function createRoundingEnd90(): RoundingPolicySpec {
  return { kind: "end_90" };
}
export function createRoundingEnd99(): RoundingPolicySpec {
  return { kind: "end_99" };
}
export function createPsychologicalRounding(
  endings: readonly number[],
): RoundingPolicySpec {
  if (!Array.isArray(endings) || endings.length === 0) {
    throw new Error("createPsychologicalRounding: endings vazio");
  }
  return { kind: "psychological", endings: [...endings] };
}

export function validateRoundingPolicy(
  value: unknown,
  path = "roundingPolicy",
): DomainIssue[] {
  if (value === undefined || value === null) return [];
  if (typeof value !== "object") {
    return [issue("INVALID_TYPE", path, `${path} deve ser objeto`)];
  }
  const spec = value as { kind?: unknown; endings?: unknown };
  if (
    typeof spec.kind !== "string" ||
    !VALID_KINDS.includes(spec.kind as RoundingPolicyKind)
  ) {
    return [
      issue(
        "INVALID_ROUNDING_POLICY",
        `${path}.kind`,
        `roundingPolicy.kind inválido`,
        { expected: VALID_KINDS, actual: spec.kind },
      ),
    ];
  }
  if (spec.kind === "psychological") {
    if (!Array.isArray(spec.endings) || spec.endings.length === 0) {
      return [
        issue(
          "INVALID_ROUNDING_POLICY",
          `${path}.endings`,
          `endings deve ser array não-vazio`,
        ),
      ];
    }
    for (let i = 0; i < spec.endings.length; i += 1) {
      const e = spec.endings[i];
      if (typeof e !== "number" || !Number.isInteger(e) || e < 0 || e > 99) {
        return [
          issue(
            "INVALID_ROUNDING_POLICY",
            `${path}.endings[${i}]`,
            `ending deve ser inteiro em [0..99]`,
            { value: e },
          ),
        ];
      }
    }
  }
  return [];
}
