import { supabase } from "@/integrations/supabase/client";
import type { InventoryMovementInsert, MovementListFilters } from "../types";
import type { LedgerAuditRow } from "../lib/ledger";

const SELECT = `
  *,
  product:products(id, name, sku, unit, stock, min_stock, cost)
`;

export const inventoryService = {
  async list(companyId: string, filters: MovementListFilters) {
    let q = supabase
      .from("inventory_movements")
      .select(SELECT, { count: "exact" })
      .eq("company_id", companyId);

    if (filters.productId) q = q.eq("product_id", filters.productId);
    if (filters.type) q = q.eq("type", filters.type);
    if (filters.source) q = q.eq("source", filters.source);
    if (filters.from) q = q.gte("movement_date", filters.from);
    if (filters.to) q = q.lte("movement_date", filters.to);

    q = q.order(filters.sortBy, { ascending: filters.sortDir === "asc" });

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    q = q.range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;

    let rows = data ?? [];
    if (filters.search.trim()) {
      const s = filters.search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.product?.name?.toLowerCase().includes(s) ||
          r.product?.sku?.toLowerCase().includes(s) ||
          r.reason?.toLowerCase().includes(s) ||
          r.notes?.toLowerCase().includes(s) ||
          r.reference_number?.toLowerCase().includes(s),
      );
    }

    return { rows, total: count ?? 0 };
  },

  async byProduct(productId: string, limit = 100) {
    const { data, error } = await supabase
      .from("inventory_movements")
      .select(SELECT)
      .eq("product_id", productId)
      .order("movement_date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async recent(companyId: string, limit = 8) {
    const { data, error } = await supabase
      .from("inventory_movements")
      .select(SELECT)
      .eq("company_id", companyId)
      .order("movement_date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async create(input: InventoryMovementInsert) {
    const { data, error } = await supabase
      .from("inventory_movements")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async metrics(companyId: string) {
    const { data, error } = await supabase.rpc("products_inventory_metrics", {
      _company_id: companyId,
    });
    if (error) throw error;
    const m = (data ?? {}) as {
      total_products?: number;
      total_stock_items?: number;
      inventory_value?: number;
      below_min_count?: number;
      today_movements?: number;
      below_min_products?: Array<{ id: string; name: string; sku: string | null; stock: number; min_stock: number }>;
      stagnant_products?: Array<{ id: string; name: string; sku: string | null; stock: number }>;
    };
    return {
      totalItems: Number(m.total_stock_items ?? 0),
      inventoryValue: Number(m.inventory_value ?? 0),
      belowMin: m.below_min_products ?? [],
      stagnant: m.stagnant_products ?? [],
      todayMovements: Number(m.today_movements ?? 0),
      productCount: Number(m.total_products ?? 0),
    };
  },

  // ============================================================
  // Sprint P0 — Razão de estoque, reconciliação e política de custo
  // ============================================================
  async ledgerAudit(companyId: string): Promise<LedgerAuditRow[]> {
    const { data, error } = await supabase.rpc("inventory_ledger_audit", {
      _company_id: companyId,
    });
    if (error) throw error;
    return ((data ?? []) as LedgerAuditRow[]).map((r) => ({
      ...r,
      opening: Number(r.opening ?? 0),
      inbound: Number(r.inbound ?? 0),
      outbound: Number(r.outbound ?? 0),
      ledger_stock: Number(r.ledger_stock ?? 0),
      current_stock: Number(r.current_stock ?? 0),
      difference: Number(r.difference ?? 0),
    }));
  },

  async reconcileOpening(companyId: string, dryRun: boolean) {
    const { data, error } = await supabase.rpc("reconcile_inventory_opening", {
      _company_id: companyId,
      _dry_run: dryRun,
    });
    if (error) throw error;
    return (data ?? {}) as {
      dry_run: boolean;
      reconciled: number;
      simulated: number;
      pending_manual: number;
      items: Array<{
        product_id: string;
        sku: string | null;
        name: string;
        before_stock: number;
        ledger_stock: number;
        adjustment: number;
        opening_movement_created: boolean;
        status: string;
      }>;
    };
  },

  async reconciliationHistory(companyId: string, limit = 100) {
    const { data, error } = await supabase
      .from("inventory_reconciliation_audit")
      .select("*, product:products(id,name,sku)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async getCostSettings(companyId: string) {
    const { data, error } = await supabase
      .from("company_inventory_settings")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw error;
    return (
      data ?? {
        company_id: companyId,
        allow_sale_without_cost: true,
        cost_method: "average" as const,
      }
    );
  },

  async updateCostSettings(
    companyId: string,
    patch: { allow_sale_without_cost?: boolean; cost_method?: "average" | "last_purchase" },
  ) {
    const { data, error } = await supabase
      .from("company_inventory_settings")
      .upsert({ company_id: companyId, ...patch }, { onConflict: "company_id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
