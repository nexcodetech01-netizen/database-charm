import { supabase } from "@/integrations/supabase/client";
import { ensureCategoryByName } from "@/features/categories/lib/ensure-category";
import { updateRow } from "@/services/supabase.service";

export const categoriesService = {
  async list(companyId: string) {
    const { data, error } = await supabase
      .from("product_categories")
      .select(`
        *,
        product_count:products(count)
      `)
      .eq("company_id", companyId)
      .order("name");
    
    if (error) throw error;
    
    return (data ?? []).map(cat => ({
      ...cat,
      product_count: cat.product_count?.[0]?.count ?? 0
    }));
  },

  async create(companyId: string, name: string, targetMarginPct?: number, defaultNcm?: string) {
    const { data, error } = await supabase
      .from("product_categories")
      .insert({ 
        company_id: companyId, 
        name: name.trim(),
        target_margin_pct: targetMarginPct,
        default_ncm: defaultNcm
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: { name?: string; target_margin_pct?: number; default_ncm?: string }) {
    return updateRow("product_categories", id, input);
  },

  async remove(id: string) {
    const { error } = await supabase
      .from("product_categories")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }
};

export interface QuickSupplierInput {
  name: string;
  document?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export const suppliersService = {
  async list(companyId: string) {
    const { data, error } = await supabase
      .from("product_suppliers")
      .select("*")
      .eq("company_id", companyId)
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
  async create(companyId: string, name: string) {
    const { data, error } = await supabase
      .from("product_suppliers")
      .insert({ company_id: companyId, name })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async createFull(companyId: string, input: QuickSupplierInput) {
    const { data, error } = await supabase
      .from("product_suppliers")
      .insert({
        company_id: companyId,
        name: input.name,
        document: input.document ?? null,
        contact_name: input.contact_name ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
