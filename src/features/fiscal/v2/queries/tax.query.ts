import type { SupabaseClient } from "@supabase/supabase-js";
import type { FiscalSettings } from "../types";
import { fetchHasSecret } from "./status.query";

export async function fetchFiscalSettings(
  supabase: SupabaseClient,
  companyId: string,
): Promise<FiscalSettings | null> {
  const { data, error } = await supabase
    .from("fiscal_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const hasCsc = await fetchHasSecret(supabase, companyId, "csc_token");
  const row = data as any;

  return {
    companyId: row.company_id,
    taxRegime: row.tax_regime,
    crt: row.crt,
    cnaePrincipal: row.cnae_principal,
    emitUf: row.emit_uf,
    nfeSeries: row.nfe_series,
    nfeNextNumber: row.nfe_next_number,
    defaultEnvironment: row.default_environment,
    operationNature: row.operation_nature,
    defaultCfop: row.default_cfop,
    defaultCsosn: row.default_csosn,
    defaultOrigem: row.default_origem ?? 0,
    emailFiscal: row.email_fiscal,
    phoneFiscal: row.phone_fiscal,
    cscId: row.csc_id,
    hasCscToken: hasCsc,
    issueOnlyAfterPayment: Boolean(row.issue_only_after_payment),
    homologationMode: row.homologation_mode ?? true,
    stockOnHomologation: row.stock_on_homologation ?? true,
    updatedAt: row.updated_at,
  };
}
