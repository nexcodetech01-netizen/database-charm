/**
 * PDV — NFC-e (Sprint 2.10).
 *
 * Camada PURA de orquestração. Não existe nenhuma regra fiscal aqui:
 * a emissão é integralmente delegada ao módulo fiscal existente
 * (`issueFiscalFromSale` → nfe-engine → provider → SEFAZ → persistência).
 *
 * Responsabilidades desta camada:
 *  - decidir se a empresa tem NFC-e habilitada (credenciais CSC configuradas);
 *  - classificar o resultado (emitida / rejeitada / SEFAZ indisponível);
 *  - garantir que a venda NUNCA seja cancelada por falha fiscal.
 */

/** O PDV emite exclusivamente NFC-e (modelo 65). */
export const PDV_FISCAL_MODEL = "65" as const;

/** Mensagem única exibida ao operador quando a NFC-e não é emitida. */
export const PDV_NFCE_FAILURE_MESSAGE =
  "Venda concluída, mas a NFC-e não pôde ser emitida.";

/** Subconjunto de `FiscalSettings` usado pelo PDV (somente leitura). */
export type PdvFiscalSettingsLike = {
  cscId: string | null;
  hasCscToken: boolean;
  defaultEnvironment?: "homologation" | "production";
} | null | undefined;

/** Subconjunto de `FiscalDocumentDto` consumido pelo PDV. */
export type PdvFiscalDocumentLike = {
  id: string;
  status: string;
  number?: number | string | null;
  accessKey?: string | null;
  danfePath?: string | null;
  xmlAuthorizedPath?: string | null;
  rejectionReason?: string | null;
};

export type PdvFiscalDocument = {
  id: string;
  status: string;
  number: string | null;
  accessKey: string | null;
  danfePath: string | null;
  xmlPath: string | null;
  /** true quando ainda aguarda retorno definitivo da SEFAZ. */
  pending: boolean;
};

export type PdvFiscalFailureReason = "rejected" | "unavailable" | "error";

export type PdvFiscalOutcome =
  | { status: "disabled" }
  | { status: "issued"; document: PdvFiscalDocument }
  | {
      status: "failed";
      reason: PdvFiscalFailureReason;
      /** Detalhe técnico (log/tooltip). A mensagem ao operador é fixa. */
      message: string;
    };

/**
 * NFC-e habilitada = credenciais CSC (ID + token) presentes nas configurações
 * fiscais já existentes. Nenhum campo novo é criado no banco.
 */
export function isPdvNfceEnabled(settings: PdvFiscalSettingsLike): boolean {
  if (!settings) return false;
  return Boolean(settings.cscId && settings.cscId.trim() && settings.hasCscToken);
}

const UNAVAILABLE_PATTERNS = [
  "timeout",
  "time out",
  "indispon",
  "offline",
  "fora do ar",
  "network",
  "failed to fetch",
  "econnreset",
  "503",
  "504",
  "gateway",
  "sefaz",
];

/** Classifica um erro lançado pela infraestrutura fiscal existente. */
export function classifyPdvFiscalError(error: unknown): {
  reason: PdvFiscalFailureReason;
  message: string;
} {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Erro desconhecido ao emitir a NFC-e.";
  const normalized = message.toLowerCase();
  const unavailable = UNAVAILABLE_PATTERNS.some((p) => normalized.includes(p));
  return { reason: unavailable ? "unavailable" : "error", message };
}

const PENDING_STATUSES = new Set(["processing", "sent", "pending", "queued"]);
const FAILED_STATUSES = new Set(["rejected", "error", "denied", "discarded"]);

function toDocument(doc: PdvFiscalDocumentLike): PdvFiscalDocument {
  return {
    id: doc.id,
    status: doc.status,
    number: doc.number == null ? null : String(doc.number),
    accessKey: doc.accessKey ?? null,
    danfePath: doc.danfePath ?? null,
    xmlPath: doc.xmlAuthorizedPath ?? null,
    pending: PENDING_STATUSES.has(doc.status),
  };
}

/**
 * Emite a NFC-e da venda reutilizando exclusivamente o fluxo fiscal existente.
 * Nunca lança: qualquer falha vira `status: "failed"` e a venda permanece
 * gravada e recebida.
 */
export async function issuePdvNfce(
  input: { saleId: string; settings: PdvFiscalSettingsLike },
  deps: {
    issue: (args: {
      saleId: string;
      environment?: "homologation" | "production";
      /** Modelo 65 = NFC-e. O PDV nunca emite outro modelo. */
      model?: "55" | "65";
    }) => Promise<PdvFiscalDocumentLike>;
  },
): Promise<PdvFiscalOutcome> {
  if (!isPdvNfceEnabled(input.settings)) return { status: "disabled" };

  try {
    const doc = await deps.issue({
      saleId: input.saleId,
      environment: input.settings?.defaultEnvironment,
      // PDV emite EXCLUSIVAMENTE NFC-e (modelo 65) no motor fiscal único.
      model: PDV_FISCAL_MODEL,
    });

    if (!doc) {
      return {
        status: "failed",
        reason: "error",
        message: "Documento fiscal não retornado.",
      };
    }

    if (FAILED_STATUSES.has(doc.status)) {
      return {
        status: "failed",
        reason: "rejected",
        message: doc.rejectionReason ?? `Documento ${doc.status}.`,
      };
    }

    return { status: "issued", document: toDocument(doc) };
  } catch (error) {
    const { reason, message } = classifyPdvFiscalError(error);
    return { status: "failed", reason, message };
  }
}

/** DANFE disponível somente com caminho de artefato persistido. */
export function canPrintPdvDanfe(outcome: PdvFiscalOutcome | null): boolean {
  return outcome?.status === "issued" && Boolean(outcome.document.danfePath);
}
