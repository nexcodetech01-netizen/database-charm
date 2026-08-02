/**
 * Commercial Configuration Domain — validador de primitivos
 * =========================================================
 * Utilitários puros. Usados internamente pelos validadores agregados.
 */
import type { DomainIssue, DomainIssueCode } from "./errors";

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function issue(
  code: DomainIssueCode,
  path: string,
  message: string,
  detail?: Readonly<Record<string, unknown>>,
): DomainIssue {
  return { code, path, message, severity: "error", detail };
}

export function warn(
  code: DomainIssueCode,
  path: string,
  message: string,
  detail?: Readonly<Record<string, unknown>>,
): DomainIssue {
  return { code, path, message, severity: "warning", detail };
}

/** Percentual finito entre `min` (default 0) e `max` (default 100). */
export function validatePct(
  value: unknown,
  path: string,
  bounds: { min?: number; max?: number } = {},
): DomainIssue[] {
  const min = bounds.min ?? 0;
  const max = bounds.max ?? 100;
  if (!isFiniteNumber(value)) {
    return [issue("INVALID_NUMBER", path, `${path} deve ser número finito`)];
  }
  if (value < min || value > max) {
    return [
      issue("OUT_OF_RANGE", path, `${path} fora do intervalo [${min}, ${max}]`, {
        value,
        min,
        max,
      }),
    ];
  }
  return [];
}

/** Inteiro em centavos ≥ 0. */
export function validateCents(value: unknown, path: string): DomainIssue[] {
  if (!isFiniteNumber(value) || !Number.isInteger(value)) {
    return [issue("INVALID_NUMBER", path, `${path} deve ser inteiro em centavos`)];
  }
  if (value < 0) {
    return [issue("NEGATIVE_COST", path, `${path} não pode ser negativo`, { value })];
  }
  return [];
}

/** Currency ISO-4217 simplificada (3 letras maiúsculas). */
export function validateCurrency(value: unknown, path: string): DomainIssue[] {
  if (!isNonEmptyString(value)) {
    return [issue("REQUIRED_FIELD", path, `${path} é obrigatório`)];
  }
  if (!/^[A-Z]{3}$/.test(value)) {
    return [
      issue("INVALID_CURRENCY", path, `${path} deve ser ISO-4217 (3 letras)`, {
        value,
      }),
    ];
  }
  return [];
}

/** ISO-8601 mínimo (validado por Date.parse). */
export function validateIsoDate(value: unknown, path: string): DomainIssue[] {
  if (!isNonEmptyString(value)) {
    return [issue("REQUIRED_FIELD", path, `${path} é obrigatório`)];
  }
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) {
    return [issue("INVALID_ISO_DATE", path, `${path} deve ser ISO-8601`, { value })];
  }
  return [];
}

export function validateRequiredString(value: unknown, path: string): DomainIssue[] {
  if (!isNonEmptyString(value)) {
    return [issue("REQUIRED_FIELD", path, `${path} é obrigatório`)];
  }
  return [];
}
