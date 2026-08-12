import type { SupabaseClient } from "@supabase/supabase-js";
import { DocumentsRepository } from "../repositories/documents.repository";
import type { NfeEventType } from "../types";

export class EventsService {
  private readonly docsRepo: DocumentsRepository;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly companyId: string,
    private readonly userId?: string
  ) {
    this.docsRepo = new DocumentsRepository(this.supabase);
  }

  async record(
    documentId: string,
    type: NfeEventType,
    payload?: Record<string, any> | null,
    actorId?: string | null
  ): Promise<void> {
    await this.docsRepo.insertEvent({
      company_id: this.companyId,
      document_id: documentId,
      event_type: type,
      actor_id: actorId || this.userId || null,
      payload: (payload || {}) as any
    });
  }

  async log(
    documentId: string,
    type: NfeEventType,
    message: string,
    payload?: Record<string, any>
  ): Promise<void> {
    await this.record(documentId, type, { ...payload, message });
  }
}


