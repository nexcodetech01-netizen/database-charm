import type { SupabaseClient } from "@supabase/supabase-js";
import type { 
  FiscalDocumentDto, 
  NfeEnvironment, 
  ProviderIssueResult
} from "../types";
import { DocumentsRepository } from "../repositories/documents.repository";
import { recordAudit } from "@/lib/audit.server";

export class EmissionService {
  private readonly docsRepo: DocumentsRepository;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly companyId: string,
    private readonly userId: string
  ) {
    this.docsRepo = new DocumentsRepository(this.supabase);
  }

  async createDraft(params: {
    saleId: string;
    totalAmount: number;
    environment: NfeEnvironment;
    provider: string;
    model: "55" | "65";
    customerId?: string | null;
    series?: number | null;
    operationNature?: string | null;
    cfop?: string | null;
    createdBy?: string | null;
    requestPayload?: any;
  }): Promise<FiscalDocumentDto> {
    const doc = await this.docsRepo.insert({
      company_id: this.companyId,
      sale_id: params.saleId,
      customer_id: params.customerId || null,
      total_amount: params.totalAmount,
      environment: params.environment,
      provider: params.provider,
      status: "draft",
      doc_type: params.model === "65" ? "nfce" : "nfe",
      model: params.model,
      series: params.series || null,
      operation_nature: params.operationNature || null,
      cfop: params.cfop || null,
      created_by: params.createdBy || this.userId || null,
      request_payload: params.requestPayload || null,
    });

    await this.docsRepo.insertEvent({
      company_id: this.companyId,
      document_id: doc.id,
      event_type: "draft",
      actor_id: this.userId,
      payload: { message: "Rascunho criado." }
    });

    return doc;
  }


  async updateAfterProvider(
    documentId: string, 
    result: ProviderIssueResult
  ): Promise<FiscalDocumentDto> {
    const patch: any = {
      status: result.status,
      updated_at: new Date().toISOString(),
    };

    if (result.accessKey) patch.access_key = result.accessKey;
    if (result.protocol) patch.protocol = result.protocol;
    if (result.number) patch.number = result.number;
    if (result.series) patch.series = result.series;
    if (result.xmlAuthorizedPath) patch.xml_authorized_path = result.xmlAuthorizedPath;
    if (result.xmlSignedPath) patch.xml_signed_path = result.xmlSignedPath;
    if (result.danfePath) patch.danfe_path = result.danfePath;
    
    if (result.rejectionCode) patch.rejection_code = result.rejectionCode;
    if (result.rejectionReason) patch.rejection_reason = result.rejectionReason;

    const doc = await this.docsRepo.update(this.companyId, documentId, patch);

    await this.docsRepo.insertEvent({
      company_id: this.companyId,
      document_id: documentId,
      event_type: result.status as any,
      actor_id: this.userId,
      payload: { 
        message: result.ok ? "Documento processado com sucesso." : "Falha no processamento.",
        rejection_code: result.rejectionCode,
        rejection_reason: result.rejectionReason,
        access_key: result.accessKey
      }
    });

    if (result.ok) {
      await recordAudit(this.supabase, {
        companyId: this.companyId,
        action: "fiscal.issue",
        module: "fiscal",
        resourceTable: "fiscal_documents",
        resourceId: documentId,
        after: { accessKey: result.accessKey, model: doc.number ? "55" : "65" }
      });
    }

    return doc;
  }

  async validate(params: {
    saleId: string;
    environment?: NfeEnvironment;
  }) {
    // A lógica pesada de validação que estava em fiscal.functions.ts 
    // deve ser movida para cá futuramente para total desacoplamento.
    // Por ora, mantemos a compatibilidade.
    return { ok: true };
  }
}


