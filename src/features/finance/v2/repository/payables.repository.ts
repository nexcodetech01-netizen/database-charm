/**
 * AccountsPayableRepository (Sprint 006)
 *
 * Espelho de AccountsReceivableRepository para `type='expense'`.
 * RLS ativa; nunca escreve `status='paid'` — pagamentos passam pela
 * RPC `settle_financial_transaction`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import type { FinancialTransactionRow } from "../types";

export interface PayablesFilters {
  status?: "pending" | "overdue" | "paid" | "cancelled";
  supplierId?: string;
  categoryId?: string;
  costCenterId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export class AccountsPayableRepository {
  private readonly supabase: SupabaseClient;
  private readonly companyId: string;

  constructor(ctx: ExecutionContext) {
    this.supabase = ctx.supabase;
    this.companyId = ctx.companyId;
  }

  async list(filters: PayablesFilters): Promise<FinancialTransactionRow[]> {
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    let q = this.supabase
      .from("financial_transactions")
      .select("*")
      .eq("company_id", this.companyId)
      .eq("type", "expense");

    if (filters.status === "overdue") {
      const today = new Date().toISOString().slice(0, 10);
      q = q.eq("status", "pending").lt("due_date", today);
    } else if (filters.status) {
      q = q.eq("status", filters.status);
    }
    if (filters.supplierId) q = q.eq("reference_id", filters.supplierId);
    if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
    if (filters.costCenterId) q = q.eq("cost_center_id", filters.costCenterId);
    if (filters.dateFrom) q = q.gte("due_date", filters.dateFrom);
    if (filters.dateTo) q = q.lte("due_date", filters.dateTo);

    q = q
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as FinancialTransactionRow[];
  }

  async insert(
    payload: Partial<FinancialTransactionRow> & Record<string, unknown>,
  ): Promise<FinancialTransactionRow> {
    const { data, error } = await this.supabase
      .from("financial_transactions")
      .insert({
        ...payload,
        company_id: this.companyId,
        type: "expense",
        status: "pending",
      })
      .select()
      .single();
    if (error) throw error;
    return data as FinancialTransactionRow;
  }

  async findById(id: string): Promise<FinancialTransactionRow | null> {
    const { data, error } = await this.supabase
      .from("financial_transactions")
      .select("*")
      .eq("company_id", this.companyId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as FinancialTransactionRow | null;
  }

  async sumOpen(): Promise<{ total: number; overdue: number }> {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await this.supabase
      .from("financial_transactions")
      .select("amount, due_date")
      .eq("company_id", this.companyId)
      .eq("type", "expense")
      .eq("status", "pending")
      .limit(5000);
    if (error) throw error;
    let total = 0;
    let overdue = 0;
    for (const r of (data ?? []) as Array<{
      amount: number | null;
      due_date: string | null;
    }>) {
      const v = Number(r.amount ?? 0);
      total += v;
      if (r.due_date && r.due_date < today) overdue += v;
    }
    return { total, overdue };
  }
}
