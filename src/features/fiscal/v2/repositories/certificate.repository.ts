import type { SupabaseClient } from "@supabase/supabase-js";
import { CERT_COLS, mapCertificate } from "../queries/certificate.query";
import type { FiscalCertificateSummary } from "../types";

/**
 * Repository para persistência de certificados fiscais.
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
}
