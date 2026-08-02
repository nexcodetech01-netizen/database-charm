/**
 * CostComponents / CostComposition — factory + validador
 * ======================================================
 * Espelha `CostComposition.v1` do Core. Adiciona validação de somatório
 * (quando componentes fornecidos) e recusa custos negativos.
 */
import { COST_COMPOSITION_VERSION, type CostComposition } from "../engine/types";
import type { DomainIssue } from "./errors";
import { issue, isFiniteNumber, validateCents, validateIsoDate } from "./primitives";

export interface CostComponentsInput {
  perUnitCostCents: number;
  weightedAverageCostCents?: number;
  acquisitionCostCents?: number;
  freightCents?: number;
  insuranceCents?: number;
  packagingCents?: number;
  otherExpensesCents?: number;
  computedAt: string;
  staleThresholdDays?: number;
  origin?: CostComposition["origin"];
}

export function createCostComposition(input: CostComponentsInput): CostComposition {
  return {
    version: COST_COMPOSITION_VERSION,
    perUnitCostCents: input.perUnitCostCents,
    weightedAverageCostCents: input.weightedAverageCostCents,
    acquisitionCostCents: input.acquisitionCostCents,
    freightCents: input.freightCents,
    insuranceCents: input.insuranceCents,
    packagingCents: input.packagingCents,
    otherExpensesCents: input.otherExpensesCents,
    computedAt: input.computedAt,
    staleThresholdDays: input.staleThresholdDays,
    origin: input.origin,
  };
}

const OPTIONAL_CENT_FIELDS: readonly (keyof CostComposition)[] = [
  "weightedAverageCostCents",
  "acquisitionCostCents",
  "freightCents",
  "insuranceCents",
  "packagingCents",
  "otherExpensesCents",
];

export function validateCostComposition(value: unknown, path = "costComposition"): DomainIssue[] {
  if (value === null || typeof value !== "object") {
    return [issue("INVALID_TYPE", path, `${path} deve ser objeto`)];
  }
  const c = value as Record<string, unknown>;
  const issues: DomainIssue[] = [];

  if (c.version !== COST_COMPOSITION_VERSION) {
    issues.push(
      issue(
        "UNSUPPORTED_CONFIG_VERSION",
        `${path}.version`,
        `versão de CostComposition não suportada`,
        { expected: COST_COMPOSITION_VERSION, actual: c.version },
      ),
    );
  }

  issues.push(...validateCents(c.perUnitCostCents, `${path}.perUnitCostCents`));
  issues.push(...validateIsoDate(c.computedAt, `${path}.computedAt`));

  for (const f of OPTIONAL_CENT_FIELDS) {
    const v = c[f];
    if (v !== undefined) issues.push(...validateCents(v, `${path}.${String(f)}`));
  }

  if (c.staleThresholdDays !== undefined) {
    if (!isFiniteNumber(c.staleThresholdDays) || c.staleThresholdDays < 0) {
      issues.push(
        issue("OUT_OF_RANGE", `${path}.staleThresholdDays`, `staleThresholdDays deve ser ≥ 0`),
      );
    }
  }

  if (c.origin !== undefined && !["inventory", "purchase", "manual"].includes(String(c.origin))) {
    issues.push(
      issue("INVALID_ENUM", `${path}.origin`, `origin inválido`, {
        expected: ["inventory", "purchase", "manual"],
        actual: c.origin,
      }),
    );
  }

  // Coerência: se componentes explícitos existem, a soma deve bater com o perUnit.
  const partsProvided = [
    c.acquisitionCostCents,
    c.freightCents,
    c.insuranceCents,
    c.packagingCents,
    c.otherExpensesCents,
  ].filter((v) => v !== undefined);

  if (partsProvided.length > 0 && issues.length === 0) {
    const sum =
      Number(c.acquisitionCostCents ?? 0) +
      Number(c.freightCents ?? 0) +
      Number(c.insuranceCents ?? 0) +
      Number(c.packagingCents ?? 0) +
      Number(c.otherExpensesCents ?? 0);
    if (sum !== Number(c.perUnitCostCents)) {
      issues.push(
        issue(
          "COST_COMPONENTS_MISMATCH",
          `${path}.perUnitCostCents`,
          `soma dos componentes (${sum}) difere de perUnitCostCents (${c.perUnitCostCents})`,
          { sum, perUnitCostCents: c.perUnitCostCents },
        ),
      );
    }
  }

  return issues;
}
