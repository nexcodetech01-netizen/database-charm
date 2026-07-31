/**
 * Application Layer — errors
 * ==========================
 * Erros específicos da camada de casos de uso. Traduzem falhas dos
 * módulos inferiores (Domain, Persistence, Engine) em códigos estáveis
 * consumíveis por UI/API sem vazar detalhes internos.
 *
 * Não repete regras de negócio — apenas classifica.
 */
import type { DomainIssue } from "../config/errors";
import type { PricingWarning } from "../engine/types";

export type ApplicationErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "CONCURRENCY"
  | "UNAUTHORIZED"
  | "INVALID_ARGUMENT"
  | "STORAGE_FAILURE"
  | "PRICING_FAILED"
  | "RESOLUTION_FAILED";

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly detail?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
  readonly issues?: readonly DomainIssue[];
  readonly warnings?: readonly PricingWarning[];

  constructor(
    code: ApplicationErrorCode,
    message: string,
    opts: {
      detail?: Readonly<Record<string, unknown>>;
      cause?: unknown;
      issues?: readonly DomainIssue[];
      warnings?: readonly PricingWarning[];
    } = {},
  ) {
    super(message);
    this.name = "ApplicationError";
    this.code = code;
    this.detail = opts.detail;
    this.cause = opts.cause;
    this.issues = opts.issues;
    this.warnings = opts.warnings;
  }
}

export const validationFailed = (
  message: string,
  issues: readonly DomainIssue[],
) =>
  new ApplicationError("VALIDATION_FAILED", message, {
    issues,
    detail: { issueCount: issues.length },
  });

export const invalidArgument = (message: string, detail?: Record<string, unknown>) =>
  new ApplicationError("INVALID_ARGUMENT", message, { detail });

export const notFound = (what: string, id: string) =>
  new ApplicationError("NOT_FOUND", `${what} not found: ${id}`, { detail: { id } });
