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
}
