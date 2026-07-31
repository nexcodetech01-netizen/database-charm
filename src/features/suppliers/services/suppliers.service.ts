import { supabase } from "@/integrations/supabase/client";
import { updateRow } from "@/services/supabase.service";
import type {
  Supplier,
  SupplierInsert,
  SupplierListFilters,
  SupplierPurchaseSummary,
  SupplierTimelineEvent,
  SupplierUpdate,
  SupplierWithMeta,
} from "../types";


interface PurchaseStats {
  count: number;
  total: number;
  last: string | null;
}

async function purchasesStatsMap(
  companyId: string,
  supplierIds: string[],
): Promise<Map<string, PurchaseStats>> {
  const stats = new Map<string, PurchaseStats>();
  if (supplierIds.length === 0) return stats;
  const { data, error } = await supabase
    .from("purchases")
    .select("supplier_id,grand_total,purchase_date,status")
    .eq("company_id", companyId)
    .in("supplier_id", supplierIds)
    .neq("status", "cancelled");
  if (error) throw error;
  (data ?? []).forEach((p) => {
    if (!p.supplier_id) return;
    const cur = stats.get(p.supplier_id) ?? { count: 0, total: 0, last: null };
    cur.count += 1;
    cur.total += Number(p.grand_total ?? 0);
    if (!cur.last || p.purchase_date > cur.last) cur.last = p.purchase_date;
    stats.set(p.supplier_id, cur);
  });
  return stats;
}

export const suppliersService = {
  async list(companyId: string, filters: SupplierListFilters) {
    let q = supabase
      .from("product_suppliers")
      .select("*", { count: "exact" })
      .eq("company_id", companyId);

    if (filters.search.trim()) {
      const s = `%${filters.search.trim()}%`;
      q = q.or(
        `name.ilike.${s},legal_name.ilike.${s},document.ilike.${s},email.ilike.${s},contact_name.ilike.${s},city.ilike.${s},phone.ilike.${s}`,
      );
    }
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.state) q = q.eq("state", filters.state);

    q = q.order(filters.sortBy, { ascending: filters.sortDir === "asc" });

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    q = q.range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) return { rows: [] as SupplierWithMeta[], total: count ?? 0 };

    const ids = rows.map((r) => r.id);
    const { data: prods, error: perr } = await supabase
      .from("products")
      .select("supplier_id")
      .in("supplier_id", ids);
    if (perr) throw perr;

    const productCounts = new Map<string, number>();
    (prods ?? []).forEach((p) => {
      if (!p.supplier_id) return;
      productCounts.set(p.supplier_id, (productCounts.get(p.supplier_id) ?? 0) + 1);
    });

    const purchaseStats = await purchasesStatsMap(companyId, ids);

    const withMeta: SupplierWithMeta[] = rows.map((r) => {
      const ps = purchaseStats.get(r.id);
      return {
        ...r,
        products_count: productCounts.get(r.id) ?? 0,
        last_purchase_at: ps?.last ?? null,
        total_purchased: ps?.total ?? 0,
        purchases_count: ps?.count ?? 0,
      };
    });

    return { rows: withMeta, total: count ?? 0 };
  },

  async metrics(companyId: string) {
    const { data, error } = await supabase
      .from("product_suppliers")
      .select("status,created_at")
      .eq("company_id", companyId);
    if (error) throw error;

    const rows = data ?? [];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { count: purchasesCount } = await supabase
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .not("supplier_id", "is", null);

    return {
      total: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      newThisMonth: rows.filter((r) => new Date(r.created_at) >= startOfMonth).length,
      purchasesLinked: purchasesCount ?? 0,
    };
  },

  async get(id: string): Promise<SupplierWithMeta | null> {
    const { data, error } = await supabase
      .from("product_suppliers")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const { count, error: perr } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", id);
    if (perr) throw perr;

    const stats = await purchasesStatsMap(data.company_id, [id]);
    const s = stats.get(id);

    return {
      ...data,
      products_count: count ?? 0,
      last_purchase_at: s?.last ?? null,
      total_purchased: s?.total ?? 0,
      purchases_count: s?.count ?? 0,
    };
  },

  async listProducts(supplierId: string) {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,sku,price,stock,status")
      .eq("supplier_id", supplierId)
      .order("name")
      .limit(50);
    if (error) throw error;
    return data ?? [];
  },

  async listPurchases(supplierId: string): Promise<SupplierPurchaseSummary[]> {
    const { data, error } = await supabase
      .from("purchases")
      .select("id,number,status,purchase_date,received_at,grand_total,items_total")
      .eq("supplier_id", supplierId)
      .order("purchase_date", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []).map((p) => ({
      id: p.id,
      number: p.number,
      status: p.status,
      purchase_date: p.purchase_date,
      received_at: p.received_at,
      grand_total: Number(p.grand_total ?? 0),
      items_total: Number(p.items_total ?? 0),
    }));
  },

  async timeline(supplier: Supplier): Promise<SupplierTimelineEvent[]> {
    const events: SupplierTimelineEvent[] = [];
    events.push({
      id: `created-${supplier.id}`,
      kind: "created",
      at: supplier.created_at,
      title: "Fornecedor cadastrado",
    });
    if (supplier.updated_at && supplier.updated_at !== supplier.created_at) {
      events.push({
        id: `updated-${supplier.id}`,
        kind: "updated",
        at: supplier.updated_at,
        title: "Cadastro atualizado",
      });
    }
    const purchases = await this.listPurchases(supplier.id);
    purchases.forEach((p) => {
      events.push({
        id: `purchase-${p.id}`,
        kind: "purchase",
        at: p.purchase_date,
        title: `Pedido de compra ${p.number}`,
        description: `Total ${p.grand_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      });
      if (p.received_at) {
        events.push({
          id: `received-${p.id}`,
          kind: "purchase_received",
          at: p.received_at,
          title: `Pedido ${p.number} recebido`,
        });
      }
    });
    events.sort((a, b) => (a.at < b.at ? 1 : -1));
    return events;
  },

  async create(input: SupplierInsert) {
    const { data, error } = await supabase
      .from("product_suppliers")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: SupplierUpdate) {
    return updateRow("product_suppliers", id, input);
  },


  async archive(id: string) {
    return this.update(id, { status: "archived" });
  },

  async restore(id: string) {
    return this.update(id, { status: "active" });
  },

  async remove(id: string) {
    const { error } = await supabase
      .from("product_suppliers")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};
