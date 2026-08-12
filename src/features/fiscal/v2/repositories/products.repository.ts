import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductNcmRow = { id: string; name: string | null; ncm: string | null };

/**
 * Repository para leitura de produtos (visão fiscal).
 */
export class ProductsRepository {
  constructor(private supabase: SupabaseClient) {}

  /** Nome + NCM dos produtos vinculados aos itens da venda. */
  async findNcmInfo(companyId: string, productIds: string[]): Promise<ProductNcmRow[]> {
    if (productIds.length === 0) return [];
    const { data, error } = await this.supabase
      .from("products")
      .select("id, name, ncm")
      .eq("company_id", companyId)
      .in("id", productIds);
    if (error) throw error;
    return (data ?? []) as unknown as ProductNcmRow[];
  }

  async findFiscalLookup(
    companyId: string,
    productIds: string[],
  ): Promise<Array<{ id: string; name: string; ncm: string | null; sku: string | null; unit: string | null }>> {
    if (productIds.length === 0) return [];
    const { data, error } = await this.supabase
      .from("products")
      .select("id, name, ncm, sku, unit")
      .eq("company_id", companyId)
      .in("id", productIds);
    if (error) throw error;
    return (data ?? []) as any[];
  }
}
