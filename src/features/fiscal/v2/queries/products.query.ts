import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProductFiscalInfo {
  id: string;
  name: string;
  ncm: string | null;
  sku: string | null;
  unit: string | null;
}

export async function fetchProductsFiscalInfo(
  supabase: SupabaseClient,
  companyId: string,
  productIds: string[],
): Promise<Map<string, ProductFiscalInfo>> {
  if (productIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, ncm, sku, unit")
    .eq("company_id", companyId)
    .in("id", productIds);
  if (error) throw error;
  const map = new Map<string, ProductFiscalInfo>();
  for (const row of (data ?? [])) {
    map.set(row.id, row as any);
  }
  return map;
}
