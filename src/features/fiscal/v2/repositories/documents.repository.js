import { FISCAL_DOCUMENT_COLUMNS } from "../lib/document-columns";
import { mapDocument } from "../queries/documents.query";
const DOC_COLS = FISCAL_DOCUMENT_COLUMNS;
/**
 * Repository para persistência de documentos fiscais.
 * SELECT, INSERT, UPDATE, DELETE, RPC, Storage.
 * Nenhuma regra de negócio.
 */
export class DocumentsRepository {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async list(companyId, filter) {
        let q = this.supabase
            .from("fiscal_documents")
            .select(DOC_COLS)
            .eq("company_id", companyId)
            .order("created_at", { ascending: false })
            .limit(filter.limit ?? 100);
        if (filter.status && filter.status !== "all")
            q = q.eq("status", filter.status);
        if (filter.saleId)
            q = q.eq("sale_id", filter.saleId);
        if (filter.from)
            q = q.gte("created_at", filter.from);
        if (filter.to)
            q = q.lte("created_at", filter.to);
        if (filter.search) {
            const term = filter.search.replace(/[%,]/g, "");
            q = q.or(`access_key.ilike.%${term}%,protocol.ilike.%${term}%`);
        }
        const { data, error } = await q;
        if (error)
            throw error;
        return (data ?? []).map(mapDocument);
    }
    async findById(companyId, id) {
        const { data, error } = await this.supabase
            .from("fiscal_documents")
            .select(DOC_COLS)
            .eq("company_id", companyId)
            .eq("id", id)
            .maybeSingle();
        if (error)
            throw error;
        return data ? mapDocument(data) : null;
    }
    async findBySaleId(companyId, saleId) {
        const { data, error } = await this.supabase
            .from("fiscal_documents")
            .select("id, status, access_key, protocol, created_at")
            .eq("company_id", companyId)
            .eq("sale_id", saleId);
        if (error)
            throw error;
        return (data ?? []);
    }
    /** Documentos das vendas listadas (estado fiscal por venda). */
    async listBySaleIds(companyId, saleIds) {
        if (saleIds.length === 0)
            return [];
        const { data, error } = await this.supabase
            .from("fiscal_documents")
            .select("sale_id, status, access_key, protocol, created_at")
            .eq("company_id", companyId)
            .in("sale_id", saleIds);
        if (error)
            throw error;
        return (data ?? []);
    }
    /** Notas autorizadas/canceladas do período, para exportação de XML. */
    async listXmlPaths(companyId, from, to) {
        const { data, error } = await this.supabase
            .from("fiscal_documents")
            .select("number, access_key, xml_authorized_path, xml_cancellation_path")
            .eq("company_id", companyId)
            .gte("created_at", from)
            .lte("created_at", to)
            .or("status.eq.authorized,status.eq.cancelled");
        if (error)
            throw error;
        return (data ?? []);
    }
    async createArtifactSignedUrl(path, expiresIn) {
        const { data, error } = await this.supabase.storage
            .from("fiscal-artifacts")
            .createSignedUrl(path, expiresIn);
        if (error)
            throw error;
        return data.signedUrl;
    }
    /** Download bruto de um artefato XML; `null` quando indisponível. */
    async downloadXmlArtifact(path) {
        const { data, error } = await this.supabase.storage.from("fiscal_artifacts").download(path);
        if (error || !data)
            return null;
        return data.arrayBuffer();
    }
    async update(companyId, id, payload) {
        const { data, error } = await this.supabase
            .from("fiscal_documents")
            .update(payload)
            .eq("company_id", companyId)
            .eq("id", id)
            .select(DOC_COLS)
            .single();
        if (error)
            throw error;
        return mapDocument(data);
    }
    async insertEvent(payload) {
        const { error } = await this.supabase.from("fiscal_events").insert(payload);
        if (error)
            throw error;
    }
    async getDashboard(companyId) {
        const { data, error } = await this.supabase
            .from("fiscal_documents")
            .select("status, total_amount, protocol_at")
            .eq("company_id", companyId);
        if (error)
            throw error;
        return data;
    }
}
