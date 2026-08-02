/**
 * TaxQuote — factory + validador (CONTRATO)
 * =========================================
 * Domínio de Pricing apenas transporta. Cálculo tributário é do Tax Engine
 * (ADR-002 / ADR-006). Aqui garantimos a forma para consumo seguro.
 */
import { TAX_QUOTE_VERSION, type TaxQuote } from "../engine/types";
import type { DomainIssue } from "./errors";
import {
  issue,
  isFiniteNumber,
  validateCents,
  validateIsoDate,
  validatePct,
  validateRequiredString,
} from "./primitives";

export interface TaxQuoteInput {
  quoteId: string;
  totalPctOnPrice: number;
  totalFixedCents: number;
  validFrom?: string;
  validTo?: string;
  taxEngineVersion: string;
}

export function createTaxQuote(input: TaxQuoteInput): TaxQuote {
  return {
    version: TAX_QUOTE_VERSION,
    quoteId: input.quoteId,
    totalPctOnPrice: input.totalPctOnPrice,
    totalFixedCents: input.totalFixedCents,
    validFrom: input.validFrom,
    validTo: input.validTo,
    taxEngineVersion: input.taxEngineVersion,
  };
}

export function validateTaxQuote(value: unknown, path = "taxQuote"): DomainIssue[] {
  if (value === null || typeof value !== "object") {
    return [issue("INVALID_TYPE", path, `${path} deve ser objeto`)];
  }
  const q = value as Record<string, unknown>;
  const issues: DomainIssue[] = [];

  if (q.version !== TAX_QUOTE_VERSION) {
    issues.push(
      issue("UNSUPPORTED_CONFIG_VERSION", `${path}.version`, `versão de TaxQuote não suportada`, {
        expected: TAX_QUOTE_VERSION,
        actual: q.version,
      }),
    );
  }

  issues.push(...validateRequiredString(q.quoteId, `${path}.quoteId`));
  issues.push(...validateRequiredString(q.taxEngineVersion, `${path}.taxEngineVersion`));

  if (!isFiniteNumber(q.totalPctOnPrice)) {
    issues.push(issue("INVALID_NUMBER", `${path}.totalPctOnPrice`, `totalPctOnPrice inválido`));
  } else {
    issues.push(...validatePct(q.totalPctOnPrice, `${path}.totalPctOnPrice`, { min: 0, max: 100 }));
  }

  issues.push(...validateCents(q.totalFixedCents, `${path}.totalFixedCents`));

  if (q.validFrom !== undefined) {
    issues.push(...validateIsoDate(q.validFrom, `${path}.validFrom`));
  }
  if (q.validTo !== undefined) {
    issues.push(...validateIsoDate(q.validTo, `${path}.validTo`));
  }
  if (
    typeof q.validFrom === "string" &&
    typeof q.validTo === "string" &&
    !issues.some((i) => i.path.startsWith(`${path}.valid`))
  ) {
    const from = Date.parse(q.validFrom);
    const to = Date.parse(q.validTo);
    if (from > to) {
      issues.push(
        issue("OUT_OF_RANGE", `${path}.validTo`, `validTo anterior a validFrom`, {
          validFrom: q.validFrom,
          validTo: q.validTo,
        }),
      );
    }
  }

  return issues;
}
