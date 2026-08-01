import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InterestProductOption {
  id: string;
  name: string;
  sku: string | null;
  stock: number | null;
}

export interface InterestCustomerOption {
  id: string;
  name: string;
  phone: string | null;
}

/** Opções para o formulário de interesse (somente leitura). */
export function useInterestProductOptions(companyId: string, search: string) {
  return useQuery({
    queryKey: ["interest-options", "products", companyId, search],
    enabled: !!companyId,
    queryFn: async (): Promise<InterestProductOption[]> => {
      let q = supabase
        .from("products")
        .select("id,name,sku,stock")
        .eq("company_id", companyId)
        .order("name")
        .limit(30);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InterestProductOption[];
    },
  });
}

export function useInterestCustomerOptions(companyId: string, search: string) {
  return useQuery({
    queryKey: ["interest-options", "customers", companyId, search],
    enabled: !!companyId,
    queryFn: async (): Promise<InterestCustomerOption[]> => {
      let q = supabase
        .from("customers")
        .select("id,name,phone")
        .eq("company_id", companyId)
        .order("name")
        .limit(30);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InterestCustomerOption[];
    },
  });
}
