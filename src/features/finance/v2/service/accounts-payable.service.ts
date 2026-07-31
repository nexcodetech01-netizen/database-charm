/**
 * AccountsPayableService (Sprint 006)
 *
 * Espelho de AccountsReceivableService para despesas.
 */
import { BaseService } from "@/features/bella-ai/agent/infrastructure/base-service";
import { emitAgentEvent } from "@/features/bella-ai/agent/infrastructure/event-bus";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import type {
  CreatePayableInput,
  EntrySummary,
  FinancialTransactionRow,
} from "../types";
import { deriveEntryStatus } from "../types";
import {
  AccountsPayableRepository,
  type PayablesFilters,
} from "../repository/payables.repository";

export interface SettlePayableInput {
  paymentMethod: string;
  accountId: string;
  paidAt?: string;
  notes?: string | null;
}

export class AccountsPayableService extends BaseService {
  private readonly repo: AccountsPayableRepository;

  constructor(ctx: ExecutionContext) {
    super(ctx);
    this.repo = new AccountsPayableRepository(ctx);
  }

  async list(filters: PayablesFilters): Promise<EntrySummary[]> {
    const rows = await this.repo.list(filters);
    return rows.map((r) => this.toSummary(r));
  }

  async create(input: CreatePayableInput): Promise<FinancialTransactionRow> {
    const row = await this.repo.insert({
      description: input.description,
      amount: input.amount,
      category_id: input.categoryId ?? null,
      cost_center_id: input.costCenterId ?? null,
      account_id: input.accountId ?? null,
      due_date: input.dueDate ?? null,
      transaction_date: input.transactionDate ?? new Date().toISOString().slice(0, 10),
      notes: input.notes ?? null,
      source: input.purchaseId ? "purchase" : "manual",
      reference_id: input.purchaseId ?? null,
    });
    await emitAgentEvent({
      type: "finance.payable.created",
      ctx: this.ctx,
      payload: { transactionId: row.id, amount: Number(row.amount ?? 0), dueDate: row.due_date },
    });
    return row;
  }

  async settle(id: string, input: SettlePayableInput): Promise<unknown> {
    const { data, error } = await this.supabase.rpc("settle_financial_transaction", {
      _transaction_id: id,
      _payment_method: input.paymentMethod,
      _account_id: input.accountId,
      _paid_at: input.paidAt ?? new Date().toISOString(),
      _notes: input.notes?.trim() ? input.notes.trim() : undefined,
    });
    if (error) throw error;
    await emitAgentEvent({
      type: "finance.payable.paid",
      ctx: this.ctx,
      payload: { transactionId: id, accountId: input.accountId, method: input.paymentMethod },
    });
    await emitAgentEvent({
      type: "finance.cash.updated",
      ctx: this.ctx,
      payload: { accountId: input.accountId, direction: "out" },
    });
    return data;
  }

  async cancel(id: string): Promise<void> {
    const cur = await this.repo.findById(id);
    if (!cur) throw new Error("Conta não encontrada.");
    if (cur.status === "paid") throw new Error("Já paga — utilize estorno.");
    const { error } = await this.supabase
      .from("financial_transactions")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("company_id", this.companyId);
    if (error) throw error;
  }

  async reverse(id: string, notes?: string): Promise<unknown> {
    const { data, error } = await this.supabase.rpc("reverse_financial_transaction", {
      _transaction_id: id,
      _notes: notes?.trim() ? notes.trim() : undefined,
    });
    if (error) throw error;
    return data;
  }

  private toSummary(r: FinancialTransactionRow): EntrySummary {
    return {
      id: r.id,
      description: r.description ?? "",
      amount: Number(r.amount ?? 0),
      status: deriveEntryStatus(r),
      dbStatus: r.status ?? "pending",
      dueDate: r.due_date ?? null,
      paidAt: r.paid_at ?? null,
      accountId: r.account_id ?? null,
      accountName: null,
      categoryId: r.category_id ?? null,
      categoryName: null,
      counterpartyName: null,
      source: r.source ?? "manual",
    };
  }
}
