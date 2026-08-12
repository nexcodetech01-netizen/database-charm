import type { SupabaseClient } from "@supabase/supabase-js";
import { FISCAL_DOCUMENT_COLUMNS } from "../lib/document-columns";
import { mapDocument } from "../queries/documents.query";
import type { FiscalDocumentDto } from "../types";

const DOC_COLS = FISCAL_DOCUMENT_COLUMNS;

export type SaleDocRow = {
  sale_id: string | null;
  status: string;
  access_key: string | null;
  protocol: string | null;
  created_at: string | null;
};

export type XmlPathRow = {
  number: number | null;
  access_key: string | null;
  xml_authorized_path: string | null;
  xml_cancellation_path: string | null;
};

/**
 * Repository para persistência de documentos fiscais.
 * SELECT, INSERT, UPDATE, DELETE, RPC, Storage.
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

  /** Documentos das vendas listadas (estado fiscal por venda). */
  async listBySaleIds(companyId: string, saleIds: string[]): Promise<SaleDocRow[]> {
    if (saleIds.length === 0) return [];
    const { data, error } = await this.supabase
      .from("fiscal_documents")
      .select("sale_id, status, access_key, protocol, created_at")
      .eq("company_id", companyId)
      .in("sale_id", saleIds);
    if (error) throw error;
    return (data ?? []) as unknown as SaleDocRow[];
  }

  /** Notas autorizadas/canceladas do período, para exportação de XML. */
  async listXmlPaths(companyId: string, from: string, to: string): Promise<XmlPathRow[]> {
    const { data, error } = await this.supabase
      .from("fiscal_documents")
      .select("number, access_key, xml_authorized_path, xml_cancellation_path")
      .eq("company_id", companyId)
      .gte("created_at", from)
      .lte("created_at", to)
      .or("status.eq.authorized,status.eq.cancelled");
    if (error) throw error;
    return (data ?? []) as unknown as XmlPathRow[];
  }

  async createArtifactSignedUrl(path: string, expiresIn: number): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from("fiscal-artifacts")
      .createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  }

  /** Download bruto de um artefato XML; `null` quando indisponível. */
  async downloadXmlArtifact(path: string): Promise<ArrayBuffer | null> {
    const { data, error } = await this.supabase.storage.from("fiscal_artifacts").download(path);
    if (error || !data) return null;
    return data.arrayBuffer();
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

  async insert(payload: any): Promise<FiscalDocumentDto> {
    const { data, error } = await this.supabase
      .from("fiscal_documents")
      .insert(payload)
      .select(DOC_COLS)
      .single();
    if (error) throw error;
    return mapDocument(data);
  }

  async insertEvent(payload: any): Promise<void> {
    const { error } = await this.supabase.from("fiscal_events").insert(payload);
    if (error) throw error;
  }

  async fetchEvents(companyId: string, documentId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from("fiscal_events")
      .select("id, document_id, event_type, payload, created_at")
      .eq("company_id", companyId)
      .eq("document_id", documentId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      documentId: r.document_id,
      eventType: r.event_type,
      payloadJson: r.payload == null ? null : JSON.stringify(r.payload),
      createdAt: r.created_at,
    }));
  }

  async getDashboard(companyId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from("fiscal_documents")
      .select("status, total_amount, protocol_at")
      .eq("company_id", companyId);
    if (error) throw error;
    return data;
  }

  async findLast(companyId: string): Promise<FiscalDocumentDto | null> {
    const { data } = await this.supabase
      .from("fiscal_documents")
      .select(DOC_COLS)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? mapDocument(data) : null;
  }
}
