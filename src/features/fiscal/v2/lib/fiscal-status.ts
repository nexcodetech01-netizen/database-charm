/**
 * Fonte ÚNICA de verdade do status fiscal exibido em qualquer tela.
 *
 * Regra inegociável: a existência de um `fiscal_document` NUNCA significa
 * "NF-e emitida". Só é emitida quando o documento ATIVO está `authorized`
 * E possui chave de acesso E protocolo.
 *
 * Toda tela (listagem de vendas, assistente de emissão, detalhe da venda,
 * listagem de notas, timeline) deve usar `getFiscalStatusBadge()`.
 */

export type FiscalBadgeKey =
  | "issued"
  | "processing"
  | "error"
  | "rejected"
  | "cancelling"
  | "cancelled"
  | "discarded"
  | "ready"
  | "incomplete"
  | "none";

export interface FiscalBadgeUi {
  key: FiscalBadgeKey;
  label: string;
  className: string;
}

/** Documento mínimo necessário para derivar o badge. */
export interface FiscalDocumentLike {
  status: string;
  accessKey?: string | null;
  protocol?: string | null;
  createdAt?: string | null;
}

const IN_FLIGHT = new Set(["draft", "validating", "signing", "sending"]);

/** Prioridade do documento ATIVO de uma venda. Descarte nunca representa a venda. */
export const FISCAL_DOC_PRIORITY: Record<string, number> = {
  cancelling: 5,
  authorized: 4,
  cancelled: 3,
  sending: 2,
  signing: 2,
  validating: 2,
  draft: 1,
  rejected: 0,
  error: 0,
  discarded: -1,
};

/** Documento fiscal vigente de uma venda (ignora tentativas descartadas). */
export function resolveActiveFiscalDocument<T extends FiscalDocumentLike>(
  docs: readonly T[] | null | undefined,
): T | null {
  const rows = (docs ?? []).filter((d) => d.status !== "discarded");
  if (rows.length === 0) return null;
  return (
    [...rows].sort((a, b) => {
      const pa = FISCAL_DOC_PRIORITY[a.status] ?? 0;
      const pb = FISCAL_DOC_PRIORITY[b.status] ?? 0;
      if (pa !== pb) return pb - pa;
      return (
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      );
    })[0] ?? null
  );
}

/**
 * Chave do badge a partir do documento ativo.
 * `null`/`undefined` → "none" (Sem NF-e).
 */
export function resolveFiscalBadgeKey(
  doc: FiscalDocumentLike | null | undefined,
): FiscalBadgeKey {
  if (!doc) return "none";
  switch (doc.status) {
    case "authorized":
      // "Emitida" exige prova de autorização na SEFAZ.
      return doc.accessKey && doc.protocol ? "issued" : "processing";
    case "cancelling":
      // Estado transitório: NÃO é cancelada nem emitida.
      return "cancelling";
    case "cancelled":
      return "cancelled";
    case "rejected":
      return "rejected";
    case "error":
      return "error";
    case "discarded":
      return "discarded";
    default:
      return IN_FLIGHT.has(doc.status) ? "processing" : "none";
  }
}

export const FISCAL_BADGE_UI: Record<FiscalBadgeKey, Omit<FiscalBadgeUi, "key">> = {
  issued: {
    label: "NF-e emitida",
    className: "border-success/20 bg-success/10 text-success",
  },
  processing: {
    label: "NF-e em processamento",
    className: "border-primary/20 bg-primary/10 text-primary",
  },
  error: {
    label: "Erro na emissão",
    className: "border-destructive/20 bg-destructive/10 text-destructive",
  },
  rejected: {
    label: "NF-e rejeitada",
    className: "border-destructive/20 bg-destructive/10 text-destructive",
  },
  cancelling: {
    label: "Cancelamento em andamento",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  cancelled: {
    label: "NF-e cancelada",
    className: "border-border bg-muted text-muted-foreground line-through",
  },
  discarded: {
    label: "Tentativa descartada",
    className: "border-border bg-muted text-muted-foreground line-through",
  },
  ready: {
    label: "Pronta para emitir",
    className: "border-success/20 bg-success/10 text-success",
  },
  incomplete: {
    label: "Dados fiscais incompletos",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  none: {
    label: "Sem NF-e",
    className: "border-border bg-muted text-muted-foreground",
  },
};

/**
 * Helper único de badge fiscal. Aceita:
 *  - um documento fiscal (ou `null`);
 *  - uma chave já resolvida no servidor (`FiscalBadgeKey`).
 */
export function getFiscalStatusBadge(
  input: FiscalDocumentLike | FiscalBadgeKey | null | undefined,
): FiscalBadgeUi {
  const key: FiscalBadgeKey =
    typeof input === "string"
      ? ((input in FISCAL_BADGE_UI ? input : "none") as FiscalBadgeKey)
      : resolveFiscalBadgeKey(input);
  return { key, ...FISCAL_BADGE_UI[key] };
}

/**
 * Regra ÚNICA de bloqueio de reemissão.
 *
 * Só bloqueia quando o documento ATIVO (mesmo helper da listagem e do detalhe)
 * está em curso ou autorizado. Documentos `error`, `rejected` e `discarded`
 * NUNCA impedem a criação de um novo documento fiscal.
 */
export function blocksNewFiscalDocument(
  docs: readonly FiscalDocumentLike[] | null | undefined,
): boolean {
  const active = resolveActiveFiscalDocument(docs);
  if (!active) return false;
  const key = resolveFiscalBadgeKey(active);
  // `cancelling` também bloqueia: o desfecho depende da SEFAZ.
  return key === "issued" || key === "processing" || key === "cancelling";
}
