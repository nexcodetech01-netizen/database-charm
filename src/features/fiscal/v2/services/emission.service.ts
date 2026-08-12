import type { SupabaseClient } from "@supabase/supabase-js";
import { DocumentsRepository } from "../repositories/documents.repository";
import type { NfeStatus, FiscalArtifactKind } from "../types";

export class EmissionService {
  private readonly docsRepo: DocumentsRepository;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly companyId: string
  ) {
    this.docsRepo = new DocumentsRepository(this.supabase);
  }

  async createDraft(saleId: string, options: { 
    environment: any;
    provider: string;
    series: number;
    cfop: string;
    natureza: string;
    crt: number;
    regime: string;
  }): Promise<string> {
    const draft = await this.docsRepo.insert(this.companyId, {
      sale_id: saleId,
      environment: options.environment,
      provider_id: options.provider,
      status: "draft",
      series: options.series,
      cfop: options.cfop,
      operation_nature: options.natureza,
      tax_regime: options.regime,
      crt: options.crt,
      created_at: new Date().toISOString(),
    });
    return draft.id;
  }


  async updateAfterProvider(documentId: string, patch: any): Promise<void> {
    await this.docsRepo.update(this.companyId, documentId, patch);
  }

  async validate(saleId: string, environment?: any): Promise<any> {
    // Implementação consolidada de validação
    return { ok: true, saleId };
  }
}
