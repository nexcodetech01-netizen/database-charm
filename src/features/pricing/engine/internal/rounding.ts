/**
 * Arredondamento comercial.
 * PRIVADO — trabalha SEMPRE em centavos (inteiros).
 */
import type { RoundingPolicySpec } from "../types";
import { isFiniteNumber, toCents } from "./math";

const CENTS_IN_UNIT = 100;

/**
 * Aplica a política de arredondamento ao preço (em centavos).
 * Retorna centavos inteiros. Nunca lança.
 */
export function applyRounding(
  priceCents: number,
  policy: RoundingPolicySpec | undefined,
): { valueCents: number; rule: string } {
  if (!isFiniteNumber(priceCents) || priceCents <= 0) {
    return { valueCents: 0, rule: "rounding:none" };
  }
  if (!policy) {
    return { valueCents: toCents(priceCents), rule: "rounding:none" };
  }

  switch (policy.kind) {
    case "none":
      return { valueCents: toCents(priceCents), rule: "rounding:none" };

    case "integer": {
      const units = Math.round(priceCents / CENTS_IN_UNIT);
      return { valueCents: units * CENTS_IN_UNIT, rule: "rounding:integer" };
    }

    case "end_90": {
      const units = Math.floor(priceCents / CENTS_IN_UNIT);
      return {
        valueCents: units * CENTS_IN_UNIT + 90,
        rule: "rounding:end_90",
      };
    }

    case "end_99": {
      const units = Math.floor(priceCents / CENTS_IN_UNIT);
      return {
        valueCents: units * CENTS_IN_UNIT + 99,
        rule: "rounding:end_99",
      };
    }

    case "psychological": {
      const endings = (policy.endings ?? []).filter(
        (n) => isFiniteNumber(n) && n >= 0 && n < CENTS_IN_UNIT,
      );
      if (endings.length === 0) {
        return { valueCents: toCents(priceCents), rule: "rounding:none" };
      }
      const units = Math.floor(priceCents / CENTS_IN_UNIT);
      const currentEnding = Math.round(priceCents - units * CENTS_IN_UNIT);
      // Escolhe a maior ending <= currentEnding, ou repete no ciclo abaixo.
      const sorted = [...endings].sort((a, b) => a - b);
      let chosen = sorted[sorted.length - 1]!;
      let deltaUnits = -1; // arredonda para baixo (unidade anterior + maior ending)
      for (const e of sorted) {
        if (e <= currentEnding) {
          chosen = e;
          deltaUnits = 0;
        }
      }
      const value =
        units * CENTS_IN_UNIT + deltaUnits * CENTS_IN_UNIT + chosen;
      return {
        valueCents: Math.max(0, value),
        rule: "rounding:psychological",
      };
    }
  }
}
