import { evaluateCancelEligibility, validateCancelReason } from "../lib/cancellation";

export class AuthorizationValidator {
  static validateCancel(doc: any, reason: string): void {
    const eligibility = evaluateCancelEligibility(doc);
    if (!eligibility.allowed) {
      throw new Error(eligibility.reason || "Documento não elegível para cancelamento.");
    }

    const reasonError = validateCancelReason(reason);
    if (reasonError) {
      throw new Error(reasonError);
    }
  }

  static validateDiscard(doc: any): void {
    if (!doc) throw new Error("Documento fiscal não encontrado.");

    if (doc.status === "authorized")
      throw new Error("NF-e autorizada não pode ser descartada — utilize o cancelamento.");
    if (doc.status === "cancelled")
      throw new Error("NF-e cancelada não pode ser descartada.");
    if (doc.status === "rejected" && doc.rejectionCode === "denied")
      throw new Error("NF-e denegada não pode ser descartada.");
    if (doc.status === "discarded")
      throw new Error("Esta tentativa já foi descartada.");
    if (doc.accessKey || doc.protocol)
      throw new Error(
        "Documento já possui chave/protocolo na SEFAZ — descarte indisponível.",
      );
    if (!(doc.status === "error" || doc.status === "rejected"))
      throw new Error(
        `Somente tentativas com erro podem ser descartadas (status atual: ${doc.status}).`,
      );
  }

  static validateRefresh(doc: any): void {
    if (!doc) {
      throw new Error("Documento não encontrado para atualização de status.");
    }

    if (doc.status === "cancelled" || doc.status === "discarded") {
      throw new Error(`Não é possível atualizar status de um documento ${doc.status}.`);
    }
  }
}
