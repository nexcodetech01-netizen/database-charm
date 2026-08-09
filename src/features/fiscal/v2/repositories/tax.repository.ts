import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Repository para persistência de configurações tributárias e fiscais.
 */
export class TaxRepository {
  constructor(private supabase: SupabaseClient) {}

  async getSettings(companyId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from("fiscal_settings")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updateSettings(companyId: string, payload: any): Promise<any> {
    const { data, error } = await this.supabase
      .from("fiscal_settings")
      .upsert({ ...payload, company_id: companyId }, { onConflict: "company_id" })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  /** Flag "emitir somente após pagamento". */
  async getIssueOnlyAfterPayment(companyId: string): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (this.supabase.from("fiscal_settings" as never) as any)
      .select("issue_only_after_payment")
      .eq("company_id", companyId)
      .maybeSingle();
    return Boolean(
      (data as { issue_only_after_payment?: boolean } | null)?.issue_only_after_payment,
    );
  }

  /** CFOP e natureza da operação padrão (contexto do documento). */
  async getDefaultCfopAndNature(
    companyId: string,
  ): Promise<{ default_cfop: string | null; operation_nature: string | null } | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (this.supabase.from("fiscal_settings" as never) as any)
      .select("default_cfop, operation_nature")
      .eq("company_id", companyId)
      .maybeSingle();
    return (data ?? null) as {
      default_cfop: string | null;
      operation_nature: string | null;
    } | null;
  }
}

