import type { SupabaseClient } from "@supabase/supabase-js";
import { DocumentsRepository } from "../repositories/documents.repository";
import type { NfeStatus, FiscalArtifactKind, FiscalSimulationResult, NfeEnvironment } from "../types";
import { CompanyValidator, PayloadValidator, ProductValidator, CustomerValidator, CertificateValidator } from "../validators";
import { toDocLikes } from "../lib/issue-guard";
import { SalesRepository } from "../repositories/sales.repository";
import { CompanyRepository } from "../repositories/company.repository";
import { CertificateRepository } from "../repositories/certificate.repository";
import { TaxRepository } from "../repositories/tax.repository";
import { StatusRepository } from "../repositories/status.repository";

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

  async validate(saleId: string, model: "55" | "65" = "55", environment?: NfeEnvironment): Promise<FiscalSimulationResult> {
    const blockers: any[] = [];
    const warnings: any[] = [];
    
    // 1) Venda
    const salesRepo = new SalesRepository(this.supabase);
    const sale = await salesRepo.findById(this.companyId, saleId);
    if (!sale) throw new Error("Venda não encontrada.");

    // 2) Duplicidade
    const existingDocs = await this.docsRepo.findBySaleId(this.companyId, saleId);
    try {
      PayloadValidator.validateIssueRequest(existingDocs, model);
    } catch (e: any) {
      blockers.push({ id: "duplicidade", field: "saleId", severity: "error", title: "Duplicidade", detail: e.message });
    }

    // 3) Empresa e Configurações
    const companyRepo = new CompanyRepository(this.supabase);
    const taxRepo = new TaxRepository(this.supabase);
    const statusRepo = new StatusRepository(this.supabase);
    
    const [company, settings, providerCfg] = await Promise.all([
      companyRepo.getProfile(this.companyId),
      taxRepo.getSettings(this.companyId),
      statusRepo.getProviderConfig(this.companyId)
    ]);
    
    try {
      CompanyValidator.validateFiscalSettings(settings);
    } catch (e: any) {
      blockers.push({ id: "config", field: "settings", severity: "error", title: "Configuração", detail: e.message });
    }

    // 4) Itens
    const items = await salesRepo.listItems(saleId);
    try {
      ProductValidator.validateItems(items);
    } catch (e: any) {
      blockers.push({ id: "itens", field: "items", severity: "error", title: "Produtos", detail: e.message });
    }

    // 5) Certificado
    const certRepo = new CertificateRepository(this.supabase);
    const activeCert = await certRepo.findActive(this.companyId);
    try {
      CertificateValidator.validate(activeCert);
    } catch (e: any) {
      blockers.push({ id: "certificado", field: "certificate", severity: "error", title: "Certificado Digital", detail: e.message });
    }

    const env = environment || settings?.defaultEnvironment || "homologation";

    return {
      ok: blockers.length === 0,
      saleId,
      environment: env,
      provider: providerCfg?.provider_id || "mock",
      blockers,
      warnings,
      summary: {
        customerName: sale.customer_name || null,
        customerDocument: sale.customer_document || null,
        customerEmail: null,
        customerAddress: null,
        itemCount: items.length,
        totalAmount: sale.grand_total || 0,
        cfop: settings?.defaultCfop || null,
        ncm: null,
        csosn: settings?.defaultCsosn || null,
        crt: settings?.crt || null,
        natureza: settings?.operationNature || null,
        series: (model === "65" ? settings?.nfceSeries : settings?.nfeSeries) || null,
        numberPreview: (model === "65" ? settings?.nfceNextNumber : settings?.nfeNextNumber) || null,
        hasCertificate: !!activeCert,
        certificateAlias: activeCert?.alias || null,
        certificateValidTo: activeCert?.validTo || null,
        hasProviderKey: true,
        certificateExpiresIn: null,
        companyName: company.legalName,
        companyCnpj: company.cnpj,
        saleNumber: sale.number ? parseInt(sale.number) : null,
        items: items.map(it => ({
          description: it.description || "",
          quantity: it.quantity || 0,
          unitPrice: it.unit_price || 0,
          total: it.total || 0,
          ncm: it.product_id ? null : null // Precisaria de lookup de produtos para NCM real aqui se quisesse detalhar
        }))
      }
    };
  }
}
