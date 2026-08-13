/**
 * ProductRepository (Sprint 002)
 *
 * Camada única de acesso a dados de `public.products` para o módulo v2.
 * Consome EXCLUSIVAMENTE o cliente Supabase autenticado do ExecutionContext
 * (RLS ativa). Nenhuma Skill fala com o banco fora daqui.
 *
 * - Não chama `supabaseAdmin`.
 * - Não faz mutações sensíveis (stock/paid_at/etc.) fora dos motores oficiais.
 * - `updateStock` continua reservado ao motor `apply_inventory_movement`
 *   (tabela `inventory_movements`) — este repositório NÃO altera `stock`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import type { Product, ProductInsert, ProductUpdate } from "../../types";
import {
  findDuplicateProduct,
  type DuplicateCandidate,
  type DuplicateProduct,
} from "../../lib/product-dedupe";

const LIST_SELECT = `
  id, sku, name, brand, price, cost, stock, min_stock, unit, status,
  category_id, supplier_id, cover_image_path, description,
  created_at, updated_at, company_id
`;

export interface ProductSearchFilters {
  search?: string;
  categoryId?: string | null;
  supplierId?: string | null;
  status?: string | null;
  onlyActive?: boolean;
  sortBy?: "name" | "price" | "stock" | "created_at";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ProductSearchResult {
  rows: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export class ProductRepository {
  private readonly supabase: SupabaseClient;
  private readonly companyId: string;

  constructor(ctx: ExecutionContext) {
    this.supabase = ctx.supabase;
    this.companyId = ctx.companyId;
  }

  async search(filters: ProductSearchFilters): Promise<ProductSearchResult> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = this.supabase
      .from("products")
      .select(LIST_SELECT, { count: "exact" })
      .eq("company_id", this.companyId);

    const search = filters.search?.trim();
    if (search) {
      const term = `%${search.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      q = q.or(`name.ilike.${term},sku.ilike.${term},barcode.ilike.${term}`);
    }
    if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
    if (filters.supplierId) q = q.eq("supplier_id", filters.supplierId);
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.onlyActive) q = q.eq("status", "active");

    const sortBy = filters.sortBy ?? "name";
    const sortDir = filters.sortDir ?? "asc";
    q = q.order(sortBy, { ascending: sortDir === "asc" }).range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;
    return {
      rows: (data ?? []) as unknown as Product[],
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async findById(id: string): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from("products")
      .select("*")
      .eq("company_id", this.companyId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as Product | null;
  }

  async findBySku(sku: string): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from("products")
      .select("*")
      .eq("company_id", this.companyId)
      .eq("sku", sku)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as Product | null;
  }

  async listLowStock(limit = 50): Promise<Product[]> {
    // filtered client-side: min_stock é comparativo por linha
    const { data, error } = await this.supabase
      .from("products")
      .select(LIST_SELECT)
      .eq("company_id", this.companyId)
      .eq("status", "active")
      .order("stock", { ascending: true })
      .limit(Math.min(500, limit * 10));
    if (error) throw error;
    const rows = ((data ?? []) as unknown as Product[]).filter(
      (r) => Number(r.stock ?? 0) <= Number(r.min_stock ?? 0),
    );
    return rows.slice(0, limit);
  }

  async insert(input: ProductInsert): Promise<Product> {
    // Sanitização de marca
    const brand = (input.brand ?? "").trim();
    if (!brand || brand.toLowerCase() === "tg") {
      input.brand = "Generica";
    }
    // company_id é responsabilidade do Service (nunca do payload do usuário)
    const { data, error } = await this.supabase
      .from("products")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as Product;
  }

  /** Deduplicação (Nome/SKU/Barcode) usando o client autenticado do contexto. */
  async findDuplicate(
    candidate: DuplicateCandidate,
    ignoreProductId?: string,
  ): Promise<DuplicateProduct | null> {
    return findDuplicateProduct(this.companyId, candidate, ignoreProductId, this.supabase);
  }

  /** Atualização parcial. `stock` nunca é alterado aqui (só via inventory_movements). */
  async update(id: string, patch: ProductUpdate): Promise<Product> {
    const safe = { ...patch } as ProductUpdate & { stock?: unknown };
    delete safe.stock;
    const { data, error } = await this.supabase
      .from("products")
      .update(safe)
      .eq("company_id", this.companyId)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Product;
  }

  async updatePrice(id: string, price: number): Promise<Product> {
    const patch: ProductUpdate = { price } as ProductUpdate;
    const { data, error } = await this.supabase
      .from("products")
      .update(patch)
      .eq("company_id", this.companyId)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Product;
  }

  /**
   * Cria a movimentação de estoque. `apply_inventory_movement` (trigger)
   * atualiza `products.stock` de forma atômica e append-only.
   */
  async insertInventoryMovement(input: {
    productId: string;
    quantity: number;
    type: "in" | "out" | "adjustment";
    source: string;
    reason?: string | null;
    notes?: string | null;
    userId: string | null;
  }): Promise<{ id: string }> {
    const { data, error } = await this.supabase
      .from("inventory_movements")
      .insert({
        company_id: this.companyId,
        product_id: input.productId,
        quantity: input.quantity,
        type: input.type,
        source: ["manual", "purchase", "sale", "adjustment", "sale_return", "sale_cancellation", "system", "opening"].includes(input.source) ? input.source : "manual",
        reason: input.reason ?? null,
        notes: input.notes ?? null,
        user_id: input.userId,
        movement_date: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: (data as { id: string }).id };
  }
}
