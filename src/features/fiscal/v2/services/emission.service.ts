import type { SupabaseClient } from "@supabase/supabase-js";
import { DocumentsRepository } from "../repositories/documents.repository";
import type { NfeStatus, FiscalArtifactKind } from "../types";

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

  async validate(saleId: string, environment?: any): Promise<any> {
    // Implementação consolidada de validação (Mock por enquanto para build)
    return { ok: true, saleId };
  }
}
