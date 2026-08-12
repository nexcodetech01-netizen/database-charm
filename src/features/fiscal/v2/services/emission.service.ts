import type { SupabaseClient } from "@supabase/supabase-js";
import { DocumentsRepository } from "../repositories/documents.repository";
import type { NfeStatus, FiscalArtifactKind } from "../types";
import { CompanyValidator, PayloadValidator, ProductValidator, CustomerValidator, CertificateValidator } from "../validators";
import { toDocLikes } from "../lib/issue-guard";
import { SalesRepository } from "../repositories/sales.repository";
import { CompanyRepository } from "../repositories/company.repository";
import { CertificateRepository } from "../repositories/certificate.repository";
import { TaxRepository } from "../repositories/tax.repository";

export class EmissionService {
  private readonly docsRepo: DocumentsRepository;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly companyId: string,
    private readonly userId?: string
  ) {
    this.docsRepo = new DocumentsRepository(this.supabase);
  }

  async createDraft(payload: {
    saleId: string;
    totalAmount: number;
    environment: any;
    provider: string;
    model: "55" | "65";
    customerId: string | null;
    series: number;
    operationNature: string | null;
    cfop: string | null;
    createdBy: string | null;
    requestPayload?: any;
  }): Promise<{ id: string }> {
    const draft = await this.docsRepo.insert({
      company_id: this.companyId,
      sale_id: payload.saleId,
      total_amount: payload.totalAmount,
      environment: payload.environment,
      provider_id: payload.provider,
      status: "draft",
      series: payload.series,
      operation_nature: payload.operationNature,
      cfop: payload.cfop,
      created_by: payload.createdBy || this.userId,
      request_payload: payload.requestPayload,
    });
    return { id: draft.id };
  }

  async updateAfterProvider(documentId: string, patch: any): Promise<void> {
    await this.docsRepo.update(this.companyId, documentId, patch);
  }

  async validate(saleId: string, model: "55" | "65" = "55", environment?: any): Promise<void> {
    // 1) Valida existência da venda
    const salesRepo = new SalesRepository(this.supabase);
    const sale = await salesRepo.findById(this.companyId, saleId);
    if (!sale) throw new Error("Venda não encontrada.");

    // 2) Valida duplicidade
    const existingDocs = await this.docsRepo.findBySaleId(this.companyId, saleId);
    PayloadValidator.validateIssueRequest(existingDocs, model);

    // 3) Valida empresa e configurações
    const companyRepo = new CompanyRepository(this.supabase);
    const taxRepo = new TaxRepository(this.supabase);
    const [company, settings] = await Promise.all([
      companyRepo.findById(this.companyId),
      taxRepo.getSettings(this.companyId)
    ]);
    
    CompanyValidator.validateFiscalSettings(settings);
    // Nota: emitter mapping em nfe-engine buildContext converte snake_case para camelCase
    // Aqui validamos os dados brutos ou o que temos no repo
    
    // 4) Valida itens
    const items = await salesRepo.listItems(saleId);
    ProductValidator.validateItems(items);

    // 5) Valida certificado
    const certRepo = new CertificateRepository(this.supabase);
    const activeCert = await certRepo.findActive(this.companyId);
    CertificateValidator.validate(activeCert);
  }
}
