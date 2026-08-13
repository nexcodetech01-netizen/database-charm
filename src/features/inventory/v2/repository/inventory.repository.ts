/**
 * InventoryRepository (Sprint 003)
 *
 * Camada única de acesso a `public.inventory_movements`. Consome
 * exclusivamente o cliente Supabase autenticado do ExecutionContext
 * (RLS ativa como o usuário). Nunca importa `supabaseAdmin`.
 *
 * REGRAS:
 *  - INSERTs disparam o trigger oficial `apply_inventory_movement`,
 *    que atualiza `products.stock` de forma atômica e append-only.
 *  - Este repositório NÃO faz UPDATE/DELETE em movimentos (append-only).
 *  - Filtro obrigatório por `company_id` em todas as consultas.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import type { InventoryMovement } from "../../types";

const SELECT_JOINED = `
  *,
  product:products(id, name, sku, unit, stock, min_stock, cost)
`;

export interface HistoryFilters {
  productId?: string | null;
  type?: string | null;
  source?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
}

export interface CreateMovementInput {
  productId: string;
  quantity: number;
  type: "in" | "out" | "adjustment";
  source: string;
  reason?: string | null;
  notes?: string | null;
  referenceNumber?: string | null;
  userId: string | null;
}

export class InventoryRepository {
  private readonly supabase: SupabaseClient;
  private readonly companyId: string;

  constructor(ctx: ExecutionContext) {
    this.supabase = ctx.supabase;
    this.companyId = ctx.companyId;
  }

  async history(filters: HistoryFilters): Promise<InventoryMovement[]> {
    let q = this.supabase
      .from("inventory_movements")
      .select(SELECT_JOINED)
      .eq("company_id", this.companyId);

    if (filters.productId) q = q.eq("product_id", filters.productId);
    if (filters.type) q = q.eq("type", filters.type);
    if (filters.source) q = q.eq("source", filters.source);
    if (filters.from) q = q.gte("movement_date", filters.from);
    if (filters.to) q = q.lte("movement_date", filters.to);

    const limit = Math.min(500, Math.max(1, filters.limit ?? 50));
    q = q.order("movement_date", { ascending: false }).limit(limit);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as InventoryMovement[];
  }

  async create(input: CreateMovementInput): Promise<InventoryMovement> {
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
        reference_number: input.referenceNumber ?? null,
        user_id: input.userId,
        movement_date: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data as InventoryMovement;
  }
}
