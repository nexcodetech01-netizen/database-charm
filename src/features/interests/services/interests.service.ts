import { supabase } from "@/integrations/supabase/client";
import type {
  InterestListFilters,
  ProductInterestInsert,
  ProductInterestRow,
  ProductInterestUpdate,
  InterestStatus,
} from "../types";

const SELECT =
  "*, product:products(id,name,sku,stock,price), customer:customers(id,name)";

/**
 * Serviço da Lista de Interesse — grava SOMENTE em `product_interests`.
 * Não cria venda, não reserva nem movimenta estoque, não gera financeiro
 * e não dispara nenhuma integração externa.
 */
export const interestsService = {
  async list(companyId: string, filters: InterestListFilters) {
    let q = supabase
      .from("product_interests")
      .select(SELECT)
      .eq("company_id", companyId)
      .order("interest_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (filters.status) q = q.eq("status", filters.status);
    if (filters.channel) q = q.eq("channel", filters.channel);
    if (filters.productId) q = q.eq("product_id", filters.productId);
    if (filters.search.trim()) {
      const s = `%${filters.search.trim()}%`;
      q = q.or(`customer_name.ilike.${s},phone.ilike.${s},notes.ilike.${s}`);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as ProductInterestRow[];
  },

  async listByProduct(productId: string) {
    const { data, error } = await supabase
      .from("product_interests")
      .select(SELECT)
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as ProductInterestRow[];
  },

  async listByCustomer(customerId: string) {
    const { data, error } = await supabase
      .from("product_interests")
      .select(SELECT)
      .eq("customer_id", customerId)
      .order("interest_date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as ProductInterestRow[];
  },

  async create(input: ProductInterestInsert) {
    const { data, error } = await supabase
      .from("product_interests")
      .insert(input)
      .select(SELECT)
      .single();
    if (error) throw error;
    return data as unknown as ProductInterestRow;
  },

  async update(id: string, input: ProductInterestUpdate) {
    const { data, error } = await supabase
      .from("product_interests")
      .update(input)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    return data as unknown as ProductInterestRow;
  },

  async setStatus(id: string, status: InterestStatus) {
    return interestsService.update(id, { status });
  },

  async remove(id: string) {
    const { error } = await supabase.from("product_interests").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
};
