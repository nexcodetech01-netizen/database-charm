/**
 * Helpers internos aos Use Cases.
 * Não exportados publicamente — apenas os Use Cases consomem.
 */
import { RepositoryError } from "../../persistence/errors";
import { ApplicationError } from "../errors";

/** Traduz erros do repositório em ApplicationError sem vazar detalhes. */
export function translateRepoError(err: unknown, what: string): ApplicationError {
  if (err instanceof RepositoryError) {
    return new ApplicationError(err.code, `${what}: ${err.message}`, {
      detail: err.detail,
      cause: err,
    });
  }
  if (err instanceof ApplicationError) return err;
  return new ApplicationError("STORAGE_FAILURE", `${what}: falha inesperada`, {
    cause: err,
  });
}

export function requireString(v: unknown, field: string): string {
  if (typeof v !== "string" || v.length === 0) {
    throw new ApplicationError("INVALID_ARGUMENT", `${field} is required`, {
      detail: { field },
    });
  }
  return v;
}
