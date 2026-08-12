import { CERT_COLS, mapCertificate } from "../queries/certificate.query";
const BUCKET = "fiscal-certificates";
/**
 * Repository para persistência de certificados fiscais (tabela + storage).
 */
export class CertificateRepository {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async list(companyId) {
        const { data, error } = await this.supabase
            .from("fiscal_certificates")
            .select(CERT_COLS)
            .eq("company_id", companyId)
            .order("created_at", { ascending: false });
        if (error)
            throw error;
        return (data ?? []).map(mapCertificate);
    }
    async findActive(companyId) {
        const { data, error } = await this.supabase
            .from("fiscal_certificates")
            .select(CERT_COLS)
            .eq("company_id", companyId)
            .eq("is_active", true)
            .maybeSingle();
        if (error)
            throw error;
        return data ? mapCertificate(data) : null;
    }
    async findById(companyId, id) {
        const { data, error } = await this.supabase
            .from("fiscal_certificates")
            .select(CERT_COLS)
            .eq("company_id", companyId)
            .eq("id", id)
            .maybeSingle();
        if (error)
            throw error;
        return data ? mapCertificate(data) : null;
    }
    /** Existência simples (validação de escopo antes de gravar segredo). */
    async exists(companyId, id) {
        const { data, error } = await this.supabase
            .from("fiscal_certificates")
            .select("id")
            .eq("company_id", companyId)
            .eq("id", id)
            .maybeSingle();
        if (error)
            throw error;
        return Boolean(data);
    }
    async update(companyId, id, payload) {
        let q = this.supabase.from("fiscal_certificates").update(payload).eq("company_id", companyId);
        if (id !== "all")
            q = q.eq("id", id);
        const { error } = await q;
        if (error)
            throw error;
    }
    async insert(payload) {
        const { data, error } = await this.supabase
            .from("fiscal_certificates")
            .insert(payload)
            .select(CERT_COLS)
            .single();
        if (error)
            throw error;
        return mapCertificate(data);
    }
    async delete(companyId, id) {
        const { error } = await this.supabase
            .from("fiscal_certificates")
            .delete()
            .eq("company_id", companyId)
            .eq("id", id);
        if (error)
            throw error;
    }
    /** Remoção via RPC (mantém segredos e vínculos consistentes). */
    async deleteViaRpc(certificateId) {
        const { error } = await this.supabase.rpc("fiscal_delete_certificate", {
            _certificate_id: certificateId,
        });
        if (error)
            throw error;
    }
    async uploadFile(path, bytes, contentType) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.storage
            .from(BUCKET)
            .upload(path, bytes, { contentType, upsert: false });
        if (error)
            throw error;
    }
    async removeFile(path) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.storage.from(BUCKET).remove([path]);
    }
}
