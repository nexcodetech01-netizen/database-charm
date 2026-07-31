/**
 * Fiscal v2 — Repositório de fiscal_events (Sprint 007.3).
 * Append-only. Colunas reais: id, company_id, document_id, event_type,
 * payload (jsonb), actor_id, created_at.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FiscalEvent, NfeEventType } from "../types";

type Row = Record<string, unknown>;

function map(row: Row): FiscalEvent {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    documentId: row.document_id as string,
    eventType: (row.event_type ?? row.type) as NfeEventType,
    payload: (row.payload as Record<string, unknown>) ?? null,
    createdAt: row.created_at as string,
  };
}

export class FiscalEventsRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly companyId: string,
    private readonly actorId?: string | null,
  ) {}

  async append(input: {
    documentId: string;
    eventType: NfeEventType;
    message?: string | null;
    payload?: Record<string, unknown> | null;
  }): Promise<FiscalEvent> {
    const payload: Record<string, unknown> = { ...(input.payload ?? {}) };
    if (input.message) payload.message = input.message;
    const { data, error } = await this.supabase
      .from("fiscal_events")
      .insert({
        company_id: this.companyId,
        document_id: input.documentId,
        event_type: input.eventType,
        payload: Object.keys(payload).length > 0 ? payload : null,
        actor_id: this.actorId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return map(data as Row);
  }

  async listByDocument(documentId: string): Promise<FiscalEvent[]> {
    const { data, error } = await this.supabase
      .from("fiscal_events")
      .select("*")
      .eq("company_id", this.companyId)
      .eq("document_id", documentId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Row[]).map(map);
  }
}
