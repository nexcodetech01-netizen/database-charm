import type { SupabaseClient } from "@supabase/supabase-js";
import { DocumentsRepository } from "../repositories/documents.repository";
import type { ProviderCancelResult, FiscalDocumentDto } from "../types";
import { recordAudit } from "@/lib/audit.server";
import { AuthorizationValidator } from "../validators";

export class CancellationService {
  private readonly docsRepo: DocumentsRepository;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly companyId: string,
    private readonly userId: string
  ) {
    this.docsRepo = new DocumentsRepository(this.supabase);
  }

  async applyCancellation(
    documentId: string,
    result: ProviderCancelResult,
    reason: string
  ): Promise<FiscalDocumentDto> {
    const current = await this.docsRepo.findById(this.companyId, documentId);
    AuthorizationValidator.validateCancel(current, reason);

    const patch: any = {
      status: result.status,
      updated_at: new Date().toISOString(),
    };

    if (result.ok) {
      patch.cancelled_at = result.cancelledAt || new Date().toISOString();
      patch.cancellation_reason = reason;
      patch.cancellation_protocol = result.protocol;
      patch.cancelled_by = this.userId;
      if (result.cancellationXmlUrl) patch.xml_cancellation_path = result.cancellationXmlUrl;
    } else {
      patch.rejection_code = result.rejectionCode;
      patch.rejection_reason = result.rejectionReason;
    }

    const doc = await this.docsRepo.update(this.companyId, documentId, patch);

    await this.docsRepo.insertEvent({
      company_id: this.companyId,
      document_id: documentId,
      event_type: result.status as any,
      actor_id: this.userId,
      payload: { 
        message: result.ok ? "Cancelamento homologado." : "Falha ao cancelar na SEFAZ.",
        reason,
        protocol: result.protocol,
        rejection_code: result.rejectionCode
      }
    });

    if (result.ok) {
      await recordAudit(this.supabase, {
        companyId: this.companyId,
        action: "fiscal.cancel",
        module: "fiscal",
        resourceTable: "fiscal_documents",
        resourceId: documentId,
        after: { reason, protocol: result.protocol }
      });
    }

    return doc;
  }

  async finalize(
    documentId: string,
    params: {
      protocol: string;
      reason: string;
      cancelledAt: string;
      xmlPath?: string | null;
    }
  ): Promise<void> {
    await this.docsRepo.update(this.companyId, documentId, {
      status: "cancelled",
      cancellation_protocol: params.protocol,
      cancellation_reason: params.reason,
      cancelled_at: params.cancelledAt,
      xml_cancellation_path: params.xmlPath || null,
      updated_at: new Date().toISOString(),
    });

    await this.docsRepo.insertEvent({
      company_id: this.companyId,
      document_id: documentId,
      event_type: "cancelled",
      actor_id: this.userId,
      payload: { 
        message: "Cancelamento confirmado pela SEFAZ.",
        protocol: params.protocol,
        reason: params.reason
      }
    });
  }
}
