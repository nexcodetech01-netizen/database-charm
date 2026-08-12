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

  static validateRefresh(doc: any): void {
    if (!doc) {
      throw new Error("Documento não encontrado para atualização de status.");
    }

    if (doc.status === "cancelled" || doc.status === "discarded") {
      throw new Error(`Não é possível atualizar status de um documento ${doc.status}.`);
    }
  }
}
