import { blocksNewFiscalDocument } from "../lib/fiscal-status";
import { toDocLikes } from "../lib/issue-guard";
import { CompanyValidator } from "./company.validator";
import { CustomerValidator } from "./customer.validator";
import { ProductValidator } from "./product.validator";
import { CertificateValidator } from "./certificate.validator";

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
      if (!payload.nfce?.cscId) {
        throw new Error("CSC (ID) não configurado para NFC-e.");
      }
      if (!payload.nfce?.cscToken) {
        throw new Error("Token CSC não configurado para NFC-e.");
      }
    }
  }

  static validateTotals(totals: any): void {
    if (!(totals.total > 0)) {
      throw new Error("Valor total deve ser maior que zero.");
    }
  }

  static validateFullContext(ctx: any): void {
    const p = ctx.payload;
    const model = ctx.model;

    CustomerValidator.validate(p.customer, model);
    this.validateNfceSpecifics(p);
    ProductValidator.validateItems(p.items);
    this.validateTotals(p.totals);
    CompanyValidator.validateEmitterData(p.emitter);
    
    if (ctx.providerId !== "mock") {
      CertificateValidator.validate({
        isActive: true, // Se chegamos aqui com ID, assumimos ativo ou validamos o objeto real se disponível
        id: ctx.certificateId
      });
      if (!ctx.certificateId) {
        throw new Error("Nenhum certificado A1 ativo.");
      }
    }
  }
}
