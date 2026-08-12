export const CERT_COLS = "id, alias, subject_name, subject_cnpj, issuer_name, valid_from, valid_to," +
    " serial_number, thumbprint, is_active, storage_path, content_type, created_at";
export function mapCertificate(row) {
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
        storagePath: row.storage_path ?? null,
        contentType: row.content_type ?? null,
        createdAt: row.created_at,
    };
}
export async function fetchFiscalCertificates(supabase, companyId) {
    const { data, error } = await supabase
        .from("fiscal_certificates")
        .select(CERT_COLS)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
    if (error)
        throw error;
    return (data ?? []).map(mapCertificate);
}
export async function fetchActiveCertificate(supabase, companyId) {
    const { data, error } = await supabase
        .from("fiscal_certificates")
        .select(CERT_COLS)
        .eq("company_id", companyId)
        .eq("is_active", true)
        .maybeSingle();
    if (error)
        throw error;
    return data ? mapCertificate(data) : null;
}
