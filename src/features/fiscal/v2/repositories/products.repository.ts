import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Repository para persistência de produtos (visão fiscal).
 */
export class ProductsRepository {
  constructor(private supabase: SupabaseClient) {}

  async findFiscalInfo(companyId: string, productIds: string[]): Promise<any[]> {
    if (productIds.length === 0) return [];
    const { data, error } = await this.supabase
      .from("products")
      .select("id, name, ncm, sku, unit")
      .eq("company_id", companyId)
      .in("id", productIds);
    if (error) throw error;
    return data ?? [];
  }
}
