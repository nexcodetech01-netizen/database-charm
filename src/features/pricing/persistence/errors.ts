/**
 * Persistence Layer — errors
 * ==========================
 * Erros de infraestrutura. NÃO carregam regras de negócio.
 * O domínio (config) usa `DomainValidationError` para regras.
 */

export type RepositoryErrorCode =
  | "NOT_FOUND"
  | "CONFLICT"
  | "CONCURRENCY"
  | "UNAUTHORIZED"
  | "INVALID_ARGUMENT"
  | "STORAGE_FAILURE";

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;
  readonly detail?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
  constructor(
    code: RepositoryErrorCode,
    message: string,
    opts: { detail?: Readonly<Record<string, unknown>>; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
    this.detail = opts.detail;
    this.cause = opts.cause;
  }
}

export const notFound = (what: string, id: string) =>
  new RepositoryError("NOT_FOUND", `${what} not found: ${id}`, { detail: { id } });

export const conflict = (what: string, detail?: Record<string, unknown>) =>
  new RepositoryError("CONFLICT", `${what} conflict`, { detail });

export const concurrency = (what: string, expected: number, actual: number) =>
  new RepositoryError(
    "CONCURRENCY",
    `${what} version mismatch (expected ${expected}, actual ${actual})`,
    { detail: { expected, actual } },
  );

export const invalidArgument = (message: string, detail?: Record<string, unknown>) =>
  new RepositoryError("INVALID_ARGUMENT", message, { detail });

export const storageFailure = (message: string, cause?: unknown) =>
  new RepositoryError("STORAGE_FAILURE", message, { cause });
