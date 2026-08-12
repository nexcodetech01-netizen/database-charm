import { blocksNewFiscalDocument, toDocLikes } from "../lib/issue-guard";

export class PayloadValidator {
  static validateIssueRequest(existingDocs: any[], model: "55" | "65"): void {
    if (blocksNewFiscalDocument(toDocLikes(existingDocs))) {
      throw new Error(
        model === "65"
          ? "Já existe uma NFC-e ativa para esta venda."
          : "Já existe uma NF-e ativa para esta venda."
      );
    }
  }

  static validateNfceSpecifics(payload: any): void {
    if (payload.model === "65") {
      if (!payload.nfce?.cscId || !payload.nfce?.cscToken) {
        throw new Error("CSC (Código de Segurança do Contribuinte) não configurado para NFC-e.");
      }
    }
  }
}
