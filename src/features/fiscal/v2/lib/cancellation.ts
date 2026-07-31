/**
 * Regras de cancelamento de NF-e (puras, sem I/O).
 *
 * Prazo legal: o cancelamento de NF-e modelo 55 só é aceito pela SEFAZ
 * dentro de 24 horas contadas da autorização (art. 20 do Ajuste SINIEF
 * 07/05). Fora desse prazo o caminho correto é a devolução/nota de entrada.
 */

export const CANCEL_REASON_MIN = 15;
export const CANCEL_REASON_MAX = 255;
export const CANCEL_WINDOW_HOURS = 24;

export type CancelEligibility = {
  allowed: boolean;
  /** Motivo do bloqueio, pronto para exibição. */
  reason?: string;
  /** Limite legal para cancelar (ISO), quando aplicável. */
  deadline?: string;
  /** Horas restantes (pode ser negativo quando expirado). */
  hoursLeft?: number;
};

export type CancelableDocument = {
  status: string;
  accessKey?: string | null;
  protocol?: string | null;
  protocolAt?: string | null;
  createdAt?: string | null;
};

/** Data-limite legal do cancelamento a partir da autorização. */
export function cancellationDeadline(
  protocolAt: string | null | undefined,
  fallback?: string | null,
): string | null {
  const base = protocolAt ?? fallback ?? null;
  if (!base) return null;
  const t = new Date(base).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + CANCEL_WINDOW_HOURS * 3600_000).toISOString();
}

/** Avalia se a NF-e pode ser cancelada agora. */
export function evaluateCancelEligibility(
  doc: CancelableDocument,
  now: Date = new Date(),
): CancelEligibility {
  if (doc.status === "cancelled") {
    return { allowed: false, reason: "Esta NF-e já está cancelada." };
  }
  if (doc.status !== "authorized") {
    return {
      allowed: false,
      reason: "Somente NF-e autorizada pode ser cancelada na SEFAZ.",
    };
  }
  if (!doc.accessKey || !doc.protocol) {
    return {
      allowed: false,
      reason: "NF-e autorizada sem chave de acesso ou protocolo.",
    };
  }
  const deadline = cancellationDeadline(doc.protocolAt, doc.createdAt);
  if (!deadline) {
    return {
      allowed: false,
      reason: "Data de autorização indisponível para validar o prazo legal.",
    };
  }
  const hoursLeft = (new Date(deadline).getTime() - now.getTime()) / 3600_000;
  if (hoursLeft <= 0) {
    return {
      allowed: false,
      deadline,
      hoursLeft,
      reason:
        "Prazo legal de 24 horas para cancelamento expirado. Emita uma nota de devolução.",
    };
  }
  return { allowed: true, deadline, hoursLeft };
}

/** Validação da justificativa exigida pela SEFAZ. */
export function validateCancelReason(reason: string): string | null {
  const value = reason.trim();
  if (value.length < CANCEL_REASON_MIN)
    return `A justificativa deve ter ao menos ${CANCEL_REASON_MIN} caracteres.`;
  if (value.length > CANCEL_REASON_MAX)
    return `A justificativa deve ter no máximo ${CANCEL_REASON_MAX} caracteres.`;
  return null;
}
