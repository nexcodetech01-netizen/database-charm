import type { SupabaseClient } from "@supabase/supabase-js";
import { CERT_COLS, mapCertificate } from "../queries/certificate.query";
import type { FiscalCertificateSummary } from "../types";

const BUCKET = "fiscal-certificates";

/**
 * Repository para persistência de certificados fiscais (tabela + storage).
 */
export class CertificateRepository {
  constructor(private supabase: SupabaseClient) {}

  async list(companyId: string): Promise<FiscalCertificateSummary[]> {
    const { data, error } = await this.supabase
      .from("fiscal_certificates")
      .select(CERT_COLS)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapCertificate);
  }

  async findActive(companyId: string): Promise<FiscalCertificateSummary | null> {
    const { data, error } = await this.supabase
      .from("fiscal_certificates")
      .select(CERT_COLS)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    return data ? mapCertificate(data) : null;
  }

  async findById(companyId: string, id: string): Promise<FiscalCertificateSummary | null> {
    const { data, error } = await this.supabase
      .from("fiscal_certificates")
      .select(CERT_COLS)
      .eq("company_id", companyId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapCertificate(data) : null;
  }

  /** Existência simples (validação de escopo antes de gravar segredo). */
  async exists(companyId: string, id: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("fiscal_certificates")
      .select("id")
      .eq("company_id", companyId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async update(companyId: string, id: string | "all", payload: any): Promise<void> {
    let q = this.supabase.from("fiscal_certificates").update(payload).eq("company_id", companyId);
    if (id !== "all") q = q.eq("id", id);
    const { error } = await q;
    if (error) throw error;
  }

  async insert(payload: any): Promise<FiscalCertificateSummary> {
    const { data, error } = await this.supabase
      .from("fiscal_certificates")
      .insert(payload)
      .select(CERT_COLS)
      .single();
    if (error) throw error;
    return mapCertificate(data);
  }

  async delete(companyId: string, id: string): Promise<void> {
    const { error } = await this.supabase
      .from("fiscal_certificates")
      .delete()
      .eq("company_id", companyId)
      .eq("id", id);
    if (error) throw error;
  }

  /** Remoção via RPC (mantém segredos e vínculos consistentes). */
  async deleteViaRpc(certificateId: string): Promise<void> {
    const { error } = await this.supabase.rpc("fiscal_delete_certificate", {
      _certificate_id: certificateId,
    });
    if (error) throw error;
  }

  async uploadFile(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: false });
    if (error) throw error;
  }

  async removeFile(path: string): Promise<void> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from(BUCKET).remove([path]);
  }
}
