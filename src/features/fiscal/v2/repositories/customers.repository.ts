import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Repository para persistência de clientes (visão fiscal).
 */
export class CustomersRepository {
  constructor(private supabase: SupabaseClient) {}

  async findFiscalInfo(companyId: string, customerId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from("customers")
      .select("id, name, document, email, street, number, district, city, state, zip")
      .eq("company_id", companyId)
      .eq("id", customerId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}
