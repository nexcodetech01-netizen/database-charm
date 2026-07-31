import { supabase } from "@/integrations/supabase/client";

export const categoriesService = {
  async list(companyId: string) {
    const { data, error } = await supabase
      .from("product_categories")
      .select("*")
      .eq("company_id", companyId)
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
  async create(companyId: string, name: string) {
    const { data, error } = await supabase
      .from("product_categories")
      .insert({ company_id: companyId, name })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
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
