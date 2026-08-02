/**
 * Commercial Configuration Domain — errors
 * ========================================
 * Zero dependências externas. Estrutura de erros reutilizada por todos os
 * validadores do domínio de configuração comercial.
 */

/** Severidade do problema encontrado. `error` bloqueia; `warning` é informativo. */
export type DomainIssueSeverity = "error" | "warning";

/** Vocabulário fechado de códigos de validação do domínio de configuração. */
export type DomainIssueCode =
  // Genéricos
  | "REQUIRED_FIELD"
  | "INVALID_TYPE"
  | "INVALID_NUMBER"
  | "OUT_OF_RANGE"
  | "INVALID_CURRENCY"
  | "INVALID_ISO_DATE"
  | "INVALID_ENUM"
  // Margens
  | "MARGIN_INCONSISTENT"
  | "INVALID_MARGIN_TARGET"
  // Cost
  | "NEGATIVE_COST"
  | "COST_COMPONENTS_MISMATCH"
  // PriceList
  | "PRICE_LIST_EMPTY"
  | "PRICE_LIST_CURRENCY_MIX"
  | "PRICE_LIST_RANGE_INVALID"
  | "PRICE_LIST_RANGE_OVERLAP"
  | "PRICE_LIST_DUPLICATE_ENTRY"
  // Channel
  | "CHANNEL_FEE_OUT_OF_RANGE"
  // Rounding
  | "INVALID_ROUNDING_POLICY"
  // Behavior
  | "INVALID_COMMERCIAL_BEHAVIOR"
  // Serialização
  | "UNSUPPORTED_CONFIG_VERSION"
  | "MALFORMED_ENVELOPE";

export interface DomainIssue {
  readonly code: DomainIssueCode;
  readonly message: string;
  readonly path: string;
  readonly severity: DomainIssueSeverity;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export class DomainValidationError extends Error {
  readonly issues: readonly DomainIssue[];
  constructor(issues: readonly DomainIssue[]) {
    super(
      `Configuration validation failed (${issues.length} issue${issues.length === 1 ? "" : "s"})`,
    );
    this.name = "DomainValidationError";
    this.issues = issues;
  }
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly DomainIssue[];
}

export const okResult: ValidationResult = { ok: true, issues: [] };

export function toResult(issues: readonly DomainIssue[]): ValidationResult {
  const hasError = issues.some((i) => i.severity === "error");
  return { ok: !hasError, issues };
}

export function throwIfInvalid(result: ValidationResult): void {
  if (!result.ok) {
    throw new DomainValidationError(result.issues.filter((i) => i.severity === "error"));
  }
}
