/**
 * SalesRepository (Sprint 005)
 *
 * Camada única de acesso a `public.sales` e `public.sale_items` para o
 * módulo v2. Consome EXCLUSIVAMENTE o cliente Supabase autenticado do
 * ExecutionContext (RLS ativa). Nenhuma Skill/Service escreve na tabela
 * fora daqui.
 *
 * - Não chama `supabaseAdmin`.
 * - Cancelamento SEMPRE via RPC `cancel_sale` (motor oficial).
 * - Reserva/baixa de estoque NÃO é feita aqui: fica em SalesReservationService,
 *   que delega ao StockService v2 (motor `apply_inventory_movement`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import type { Sale, SaleInsert, SaleItem } from "../../types";
import type { SalesOrderStatus } from "../types";
import { V2_TO_DB_STATUS } from "../types";

const LIST_SELECT = `
  id, number, customer_id, status, sale_date, paid_at,
  items_total, discount, shipping, grand_total,
  created_at, updated_at, company_id, notes
`;

export interface SalesListFilters {
  query?: string;
  customerId?: string;
  status?: SalesOrderStatus;
  dbStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface SaleWithItemsRow extends Sale {
  items: SaleItem[];
  customer_name: string | null;
}

export class SalesRepository {
  private readonly supabase: SupabaseClient;
  private readonly companyId: string;

  constructor(ctx: ExecutionContext) {
    this.supabase = ctx.supabase;
    this.companyId = ctx.companyId;
  }

  async list(filters: SalesListFilters): Promise<Sale[]> {
    const limit = Math.min(200, Math.max(1, filters.limit ?? 20));
    let q = this.supabase
      .from("sales")
      .select(LIST_SELECT)
      .eq("company_id", this.companyId);

    if (filters.customerId) q = q.eq("customer_id", filters.customerId);
    if (filters.dbStatus) q = q.eq("status", filters.dbStatus);
    else if (filters.status) q = q.eq("status", V2_TO_DB_STATUS[filters.status]);
    if (filters.dateFrom) q = q.gte("sale_date", filters.dateFrom);
    if (filters.dateTo) q = q.lte("sale_date", filters.dateTo);
    if (filters.query) {
      const term = `%${filters.query.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      q = q.or(`notes.ilike.${term}`);
    }

    q = q.order("created_at", { ascending: false }).limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as Sale[];
  }

  async findById(id: string): Promise<Sale | null> {
    const { data, error } = await this.supabase
      .from("sales")
      .select(LIST_SELECT)
      .eq("company_id", this.companyId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as Sale | null;
  }

  async findItems(saleId: string): Promise<SaleItem[]> {
    const { data, error } = await this.supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", saleId)
      .order("position", { ascending: true });
    if (error) throw error;
    return (data ?? []) as SaleItem[];
  }

  async insertHead(payload: SaleInsert): Promise<Sale> {
    const { data, error } = await this.supabase
      .from("sales")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as Sale;
  }

  async insertItems(
    rows: Array<Omit<SaleItem, "id" | "created_at" | "updated_at">>,
  ): Promise<SaleItem[]> {
    if (rows.length === 0) return [];
    const { data, error } = await this.supabase
      .from("sale_items")
      .insert(rows as never)
      .select();
    if (error) throw error;
    return (data ?? []) as SaleItem[];
  }

  /**
   * Cancelamento passa OBRIGATORIAMENTE pelo motor oficial
   * `public.cancel_sale(_sale_id, _reason)` — nunca UPDATE direto no status.
   */
  async cancelViaRpc(saleId: string, reason?: string | null): Promise<Sale> {
    const { data, error } = await this.supabase.rpc("cancel_sale", {
      _sale_id: saleId,
      _reason: reason ?? null,
    });
    if (error) throw error;
    return data as unknown as Sale;
  }
}
