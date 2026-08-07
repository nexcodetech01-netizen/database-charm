import type { SupabaseClient } from "@supabase/supabase-js";
import type { FiscalCertificateSummary } from "../types";

export const CERT_COLS =
  "id, alias, subject_name, subject_cnpj, issuer_name, valid_from, valid_to," +
  " serial_number, thumbprint, is_active, created_at";

export function mapCertificate(row: any): FiscalCertificateSummary {
  return {
    id: row.id,
    alias: row.alias,
    subjectName: row.subject_name ?? null,
    subjectCnpj: row.subject_cnpj ?? null,
    issuerName: row.issuer_name ?? null,
    validFrom: row.valid_from ?? null,
    validTo: row.valid_to ?? null,
    serialNumber: row.serial_number ?? null,
    thumbprint: row.thumbprint ?? null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

export async function fetchFiscalCertificates(
  supabase: SupabaseClient,
  companyId: string,
): Promise<FiscalCertificateSummary[]> {
  const { data, error } = await supabase
    .from("fiscal_certificates")
    .select(CERT_COLS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCertificate);
}

export async function fetchActiveCertificate(
  supabase: SupabaseClient,
  companyId: string,
): Promise<FiscalCertificateSummary | null> {
  const { data, error } = await supabase
    .from("fiscal_certificates")
    .select(CERT_COLS)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data ? mapCertificate(data) : null;
}
