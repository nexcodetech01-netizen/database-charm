/**
 * StockRepository (Sprint 003)
 *
 * Leitura consolidada de saldo/mínimo/última movimentação por produto,
 * usando exclusivamente o cliente Supabase autenticado do ExecutionContext.
 * Nunca escreve em `products.stock` — o motor oficial é
 * `apply_inventory_movement` (via InventoryRepository).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";

export interface StockRow {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  stock: number;
  min_stock: number;
  cost: number;
  status: string | null;
}

export interface StagnantRow extends StockRow {
  last_movement_at: string | null;
}

const COLS = "id, name, sku, unit, stock, min_stock, cost, status";

export class StockRepository {
  private readonly supabase: SupabaseClient;
  private readonly companyId: string;

  constructor(ctx: ExecutionContext) {
    this.supabase = ctx.supabase;
    this.companyId = ctx.companyId;
  }

  async findProductById(id: string): Promise<StockRow | null> {
    const { data, error } = await this.supabase
      .from("products")
      .select(COLS)
      .eq("company_id", this.companyId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as StockRow | null) ?? null;
  }

  async findProductBySkuOrName(term: string): Promise<StockRow | null> {
    const t = term.trim();
    if (!t) return null;
    // Tenta SKU exato primeiro (case-insensitive), depois nome parcial.
    const bySku = await this.supabase
      .from("products")
      .select(COLS)
      .eq("company_id", this.companyId)
      .ilike("sku", t)
      .limit(1)
      .maybeSingle();
    if (bySku.error) throw bySku.error;
    if (bySku.data) return bySku.data as StockRow;

    const escaped = t.replace(/[%_]/g, (m) => `\\${m}`);
    const byName = await this.supabase
      .from("products")
      .select(COLS)
      .eq("company_id", this.companyId)
      .or(`name.ilike.%${escaped}%,sku.ilike.%${escaped}%,barcode.ilike.%${escaped}%`)
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (byName.error) throw byName.error;
    return (byName.data as StockRow | null) ?? null;
  }

  /**
   * Produtos ativos com `stock <= min_stock`. O ranking é feito no banco
   * (order by stock asc) e o filtro comparativo é aplicado em memória
   * porque PostgREST não expõe comparação entre colunas.
   */
  async listLowStock(limit = 50): Promise<StockRow[]> {
    const { data, error } = await this.supabase
      .from("products")
      .select(COLS)
      .eq("company_id", this.companyId)
      .eq("status", "active")
      .order("stock", { ascending: true })
      .limit(Math.min(500, limit * 10));
    if (error) throw error;
    const rows = ((data ?? []) as StockRow[]).filter(
      (r) => Number(r.stock ?? 0) <= Number(r.min_stock ?? 0),
    );
    return rows.slice(0, limit);
  }

  async listOutOfStock(limit = 50): Promise<StockRow[]> {
    const { data, error } = await this.supabase
      .from("products")
      .select(COLS)
      .eq("company_id", this.companyId)
      .eq("status", "active")
      .lte("stock", 0)
      .order("name", { ascending: true })
      .limit(Math.min(500, limit));
    if (error) throw error;
    return (data ?? []) as StockRow[];
  }
}
