/**
 * Fiscal v2 — Guarda de emissão única por venda.
 *
 * Fonte ÚNICA de verdade sobre "o que é um documento fiscal ativo".
 * O mesmo conjunto de status é usado:
 *   - no índice único parcial `fiscal_documents_one_active_per_sale` (banco);
 *   - na checagem prévia do motor de emissão (servidor);
 *   - na recuperação idempotente após colisão de concorrência.
 *
 * Regra: uma venda só pode ter UM documento ativo. Documentos
 * `rejected`, `error`, `cancelled` e `discarded` não bloqueiam reemissão.
 * `cancelling` bloqueia: o desfecho ainda depende da SEFAZ.
 */

/** Status que ocupam a venda e bloqueiam nova emissão. */
export const ACTIVE_FISCAL_STATUSES = [
  "draft",
  "validating",
  "signing",
  "sending",
  "authorized",
  /** Cancelamento solicitado — a venda segue ocupada até a SEFAZ decidir. */
  "cancelling",
] as const;

export type ActiveFiscalStatus = (typeof ACTIVE_FISCAL_STATUSES)[number];

const ACTIVE_SET = new Set<string>(ACTIVE_FISCAL_STATUSES);

/** Nome do índice único parcial que garante a regra no banco. */
export const ACTIVE_SALE_INDEX = "fiscal_documents_one_active_per_sale";

/** Um documento nesse status ocupa a venda? */
export function isActiveFiscalStatus(status: unknown): boolean {
  return typeof status === "string" && ACTIVE_SET.has(status);
}

/** Documento fiscal ativo dentre uma lista (o mais recente vence). */
export function findActiveDocument<T extends { status?: unknown }>(
  docs: readonly T[] | null | undefined,
): T | null {
  if (!docs?.length) return null;
  return docs.find((d) => isActiveFiscalStatus(d.status)) ?? null;
}

/** Transforma DTOs ou linhas do banco em interface compatível com lib/fiscal-status */
export function toDocLikes(rows: any[]): any[] {
  return rows.map((r) => ({
    status: r.status,
    accessKey: r.access_key || r.accessKey,
    protocol: r.protocol,
    createdAt: r.created_at || r.createdAt,
  }));
}

/** Erro do Postgres é violação do índice único de emissão ativa? */
export function isActiveSaleUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown; details?: unknown };
  if (e.code !== "23505") return false;
  const haystack = `${String(e.message ?? "")} ${String(e.details ?? "")}`;
  return haystack.includes(ACTIVE_SALE_INDEX);
}

