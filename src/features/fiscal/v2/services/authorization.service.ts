import type { SupabaseClient } from "@supabase/supabase-js";
import { DocumentsRepository } from "../repositories/documents.repository";
import type { ProviderStatusResult, FiscalDocumentDto } from "../types";

export class AuthorizationService {
  private readonly docsRepo: DocumentsRepository;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly companyId: string,
    private readonly userId: string
  ) {
    this.docsRepo = new DocumentsRepository(this.supabase);
  }

  async refreshStatus(
    documentId: string,
    result: ProviderStatusResult
  ): Promise<FiscalDocumentDto> {
    const patch: any = {
      status: result.status,
      updated_at: new Date().toISOString(),
    };

    if (result.accessKey) patch.access_key = result.accessKey;
    if (result.protocol) patch.protocol = result.protocol;
    
    // Artefatos podem ser retornados no refresh se estiverem pendentes
    if (result.xmlAuthorizedPath) patch.xml_authorized_path = result.xmlAuthorizedPath;
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
        message: `Status atualizado para ${result.status}.`,
        rejection_code: result.rejectionCode,
        rejection_reason: result.rejectionReason
      }
    });

    return doc;
  }
  async captureProtocol(
    documentId: string,
    protocol: string,
    protocolAt?: string
  ): Promise<void> {
    await this.docsRepo.update(this.companyId, documentId, {
      protocol,
      protocol_at: protocolAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await this.docsRepo.insertEvent({
      company_id: this.companyId,
      document_id: documentId,
      event_type: "authorized",
      actor_id: this.userId,
      payload: { 
        message: "Protocolo de autorização capturado.",
        protocol 
      }
    });
  }
}


