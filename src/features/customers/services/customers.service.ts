import { supabase } from "@/integrations/supabase/client";
import { updateRow } from "@/services/supabase.service";
import type {
  Customer,
  CustomerInsert,
  CustomerInteraction,
  CustomerInteractionInsert,
  CustomerListFilters,
  CustomerUpdate,
} from "../types";


export const customersService = {
  async list(companyId: string, filters: CustomerListFilters) {
    let q = supabase
      .from("customers")
      .select("*", { count: "exact" })
      .eq("company_id", companyId);

    if (filters.search.trim()) {
      const s = `%${filters.search.trim()}%`;
      q = q.or(
        `name.ilike.${s},document.ilike.${s},email.ilike.${s},phone.ilike.${s},whatsapp.ilike.${s},city.ilike.${s}`,
      );
    }
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.segment) q = q.eq("segment", filters.segment);
    if (filters.state) q = q.eq("state", filters.state);

    q = q.order(filters.sortBy, {
      ascending: filters.sortDir === "asc",
      nullsFirst: false,
    });

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    q = q.range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;
    return { rows: (data ?? []) as Customer[], total: count ?? 0 };
  },

  async metrics(companyId: string) {
    const { data, error } = await supabase
      .from("customers")
      .select("status,created_at,last_interaction_at")
      .eq("company_id", companyId);
    if (error) throw error;

    const rows = data ?? [];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    return {
      total: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      newThisMonth: rows.filter((r) => new Date(r.created_at) >= startOfMonth).length,
      inactive90: rows.filter((r) => {
        const ref = r.last_interaction_at ? new Date(r.last_interaction_at) : new Date(r.created_at);
        return ref < ninetyDaysAgo;
      }).length,
    };
  },

  async get(id: string) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as Customer | null;
  },

  async create(input: CustomerInsert) {
    const { data, error } = await supabase
      .from("customers")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as Customer;
  },

  async update(id: string, input: CustomerUpdate) {
    return (await updateRow("customers", id, input)) as Customer;
  },


  async archive(id: string) {
    return this.update(id, { status: "archived" });
  },
  async restore(id: string) {
    return this.update(id, { status: "active" });
  },
  async remove(id: string) {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
  },

  async listInteractions(customerId: string) {
    const { data, error } = await supabase
      .from("customer_interactions")
      .select("*")
      .eq("customer_id", customerId)
      .order("occurred_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as CustomerInteraction[];
  },

  async createInteraction(input: CustomerInteractionInsert) {
    const { data, error } = await supabase
      .from("customer_interactions")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as CustomerInteraction;
  },

  async removeInteraction(id: string) {
    const { error } = await supabase.from("customer_interactions").delete().eq("id", id);
    if (error) throw error;
  },
};
