/**
 * CashFlowRepository (Sprint 006)
 *
 * Somente leitura: saldos de conta, agenda de vencimentos e histórico
 * de baixas. RLS ativa; nunca escreve saldo direto — movimentações
 * passam pelas RPCs oficiais.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import type { CashPositionSnapshot, FinancialTransactionRow } from "../types";

export class CashFlowRepository {
  private readonly supabase: SupabaseClient;
  private readonly companyId: string;

  constructor(ctx: ExecutionContext) {
    this.supabase = ctx.supabase;
    this.companyId = ctx.companyId;
  }

  async cashPosition(): Promise<CashPositionSnapshot> {
    const { data, error } = await this.supabase
      .from("financial_accounts")
      .select("id, name, type, current_balance, status")
      .eq("company_id", this.companyId);
    if (error) throw error;
    const per: CashPositionSnapshot["perAccount"] = [];
    let total = 0;
    for (const r of (data ?? []) as Array<{
      id: string;
      name: string | null;
      type: string | null;
      current_balance: number | null;
      status: string | null;
    }>) {
      if (r.status && r.status !== "active") continue;
      const bal = Number(r.current_balance ?? 0);
      total += bal;
      per.push({
        id: r.id,
        name: r.name ?? "Conta",
        balance: bal,
        type: r.type ?? "bank",
      });
    }
    return { totalBalance: total, perAccount: per };
  }

  /** Vencimentos futuros (pending) num intervalo de datas. */
  async pendingBetween(
    isoFrom: string,
    isoTo: string,
  ): Promise<FinancialTransactionRow[]> {
    const { data, error } = await this.supabase
      .from("financial_transactions")
      .select("*")
      .eq("company_id", this.companyId)
      .eq("status", "pending")
      .gte("due_date", isoFrom)
      .lte("due_date", isoTo)
      .limit(5000);
    if (error) throw error;
    return (data ?? []) as FinancialTransactionRow[];
  }

  /** Baixas realizadas num intervalo (paid_at). */
  async paidBetween(
    isoFromInclusive: string,
    isoToExclusive: string,
  ): Promise<FinancialTransactionRow[]> {
    const { data, error } = await this.supabase
      .from("financial_transactions")
      .select("*")
      .eq("company_id", this.companyId)
      .eq("status", "paid")
      .gte("paid_at", isoFromInclusive)
      .lt("paid_at", isoToExclusive)
      .limit(5000);
    if (error) throw error;
    return (data ?? []) as FinancialTransactionRow[];
  }
}
