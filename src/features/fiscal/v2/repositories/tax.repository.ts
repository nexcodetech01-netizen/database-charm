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

  async updateSettings(companyId: string, payload: any): Promise<void> {
    const { error } = await this.supabase
      .from("fiscal_settings")
      .update(payload)
      .eq("company_id", companyId);
    if (error) throw error;
  }
}
