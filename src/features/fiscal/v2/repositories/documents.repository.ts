import type { SupabaseClient } from "@supabase/supabase-js";
import { FISCAL_DOCUMENT_COLUMNS } from "../lib/document-columns";
import { mapDocument } from "../queries/documents.query";
import type { FiscalDocumentDto, NfeStatus } from "../types";

const DOC_COLS = FISCAL_DOCUMENT_COLUMNS;

/**
 * Repository para persistência de documentos fiscais.
 * SELECT, INSERT, UPDATE, DELETE, RPC.
 * Nenhuma regra de negócio.
 */
export class DocumentsRepository {
  constructor(private supabase: SupabaseClient) {}

  async list(companyId: string, filter: any): Promise<FiscalDocumentDto[]> {
    let q = this.supabase
      .from("fiscal_documents")
      .select(DOC_COLS)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(filter.limit ?? 100);

    if (filter.status && filter.status !== "all") q = q.eq("status", filter.status);
    if (filter.saleId) q = q.eq("sale_id", filter.saleId);
    if (filter.from) q = q.gte("created_at", filter.from);
    if (filter.to) q = q.lte("created_at", filter.to);
    if (filter.search) {
      const term = filter.search.replace(/[%,]/g, "");
      q = q.or(`access_key.ilike.%${term}%,protocol.ilike.%${term}%`);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(mapDocument);
  }

  async findById(companyId: string, id: string): Promise<FiscalDocumentDto | null> {
    const { data, error } = await this.supabase
      .from("fiscal_documents")
      .select(DOC_COLS)
      .eq("company_id", companyId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapDocument(data) : null;
  }

  async findBySaleId(companyId: string, saleId: string): Promise<FiscalDocumentDto[]> {
    const { data, error } = await this.supabase
      .from("fiscal_documents")
      .select("id, status, access_key, protocol, created_at")
      .eq("company_id", companyId)
      .eq("sale_id", saleId);
    if (error) throw error;
    return (data ?? []) as any[];
  }

  async update(companyId: string, id: string, payload: any): Promise<FiscalDocumentDto> {
    const { data, error } = await this.supabase
      .from("fiscal_documents")
      .update(payload)
      .eq("company_id", companyId)
      .eq("id", id)
      .select(DOC_COLS)
      .single();
    if (error) throw error;
    return mapDocument(data);
  }

  async insertEvent(payload: any): Promise<void> {
    const { error } = await this.supabase.from("fiscal_events").insert(payload);
    if (error) throw error;
  }

  async getDashboard(companyId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from("fiscal_documents")
      .select("status, total_amount, protocol_at")
      .eq("company_id", companyId);
    if (error) throw error;
    return data;
  }
}
