/**
 * Sprint P0.6.2 — Integridade fiscal das vendas (camada de negócio).
 *
 * Regra: uma venda que possua documento fiscal vinculado em estado
 * protegido NÃO pode ser excluída. Isso evita que uma NF-e autorizada,
 * em cancelamento ou já cancelada perca o vínculo com a venda de origem.
 *
 * A fonte única dos status "ocupados" continua sendo
 * `ACTIVE_FISCAL_STATUSES` (fiscal/v2). Aqui apenas acrescentamos
 * `cancelled`: o documento deixou de ocupar a venda para fins de
 * reemissão, mas continua sendo um registro fiscal que precisa manter
 * rastreabilidade com a venda.
 *
 * Escopo fechado: nenhuma alteração de FK, migration ou regra fiscal.
 */
import { ACTIVE_FISCAL_STATUSES } from "@/features/fiscal/v2/lib/issue-guard";

/** Mensagem única exibida ao usuário quando a exclusão é bloqueada. */
export const FISCAL_DELETE_BLOCKED_MESSAGE =
  "Esta venda possui documento fiscal vinculado e não pode ser excluída.";

/** Status de documento fiscal que impedem a exclusão da venda. */
export const FISCAL_DELETE_BLOCKING_STATUSES = [
  ...ACTIVE_FISCAL_STATUSES,
  "cancelled",
] as const;

const BLOCKING_SET = new Set<string>(FISCAL_DELETE_BLOCKING_STATUSES);

/** O status do documento bloqueia a exclusão da venda? */
export function blocksSaleDeletion(status: unknown): boolean {
  return typeof status === "string" && BLOCKING_SET.has(status);
}

export interface FiscalDocumentRef {
  readonly id: string;
  readonly status?: unknown;
  readonly number?: number | string | null;
}

/**
 * Retorna o primeiro documento fiscal que impede a exclusão, ou `null`
 * quando a venda está livre para ser excluída.
 */
export function findBlockingFiscalDocument<T extends FiscalDocumentRef>(
  docs: readonly T[] | null | undefined,
): T | null {
  if (!docs?.length) return null;
  return docs.find((d) => blocksSaleDeletion(d.status)) ?? null;
}

/** Erro de negócio dedicado — permite à UI reagir sem parsear string. */
export class FiscalDeleteBlockedError extends Error {
  readonly code = "SALE_HAS_FISCAL_DOCUMENT";
  readonly documentId: string;
  readonly documentStatus: string;

  constructor(documentId: string, documentStatus: string) {
    super(FISCAL_DELETE_BLOCKED_MESSAGE);
    this.name = "FiscalDeleteBlockedError";
    this.documentId = documentId;
    this.documentStatus = documentStatus;
  }
}

export function isFiscalDeleteBlockedError(err: unknown): err is FiscalDeleteBlockedError {
  return err instanceof FiscalDeleteBlockedError;
}
