/**
 * AccountsReceivableService (Sprint 006)
 *
 * Orquestra contas a receber. Toda baixa passa por
 * `settle_financial_transaction`; todo estorno por
 * `reverse_financial_transaction`. Nunca escreve `status='paid'` direto.
 */
import { BaseService } from "@/features/bella-ai/agent/infrastructure/base-service";
import { emitAgentEvent } from "@/features/bella-ai/agent/infrastructure/event-bus";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import type {
  CreateReceivableInput,
  EntrySummary,
  FinancialTransactionRow,
} from "../types";
import { deriveEntryStatus } from "../types";
import {
  AccountsReceivableRepository,
  type ReceivablesFilters,
} from "../repository/receivables.repository";

export interface SettleReceivableInput {
  paymentMethod: string;
  accountId: string;
  paidAt?: string;
  notes?: string | null;
}

export class AccountsReceivableService extends BaseService {
  private readonly repo: AccountsReceivableRepository;

  constructor(ctx: ExecutionContext) {
    super(ctx);
    this.repo = new AccountsReceivableRepository(ctx);
  }

  async list(filters: ReceivablesFilters): Promise<EntrySummary[]> {
    const rows = await this.repo.list(filters);
    return rows.map((r) => this.toSummary(r));
  }

  /** Criação (com opção de parcelamento). Um único evento por lançamento. */
  async create(input: CreateReceivableInput): Promise<FinancialTransactionRow[]> {
    const count = Math.max(1, Math.min(120, Number(input.installments ?? 1)));
    const interval = Math.max(1, Math.min(365, Number(input.installmentIntervalDays ?? 30)));
    const perAmount = Number((input.amount / count).toFixed(2));
    const results: FinancialTransactionRow[] = [];
    const baseDue = input.dueDate ? new Date(`${input.dueDate}T00:00:00`) : null;

    for (let i = 0; i < count; i++) {
      const due = baseDue
        ? new Date(baseDue.getTime() + i * interval * 86400_000)
        : null;
      const row = await this.repo.insert({
        description:
          count > 1 ? `${input.description} (${i + 1}/${count})` : input.description,
        amount: i === count - 1 ? Number((input.amount - perAmount * (count - 1)).toFixed(2)) : perAmount,
        category_id: input.categoryId ?? null,
        account_id: input.accountId ?? null,
        due_date: due ? due.toISOString().slice(0, 10) : null,
        transaction_date: input.transactionDate ?? new Date().toISOString().slice(0, 10),
        notes: input.notes ?? null,
        source: input.saleId ? "sale" : "manual",
        reference_id: input.saleId ?? null,
      });
      results.push(row);
      await emitAgentEvent({
        type: "finance.receivable.created",
        ctx: this.ctx,
        payload: {
          transactionId: row.id,
          amount: Number(row.amount ?? 0),
          dueDate: row.due_date,
        },
      });
    }
    return results;
  }

  /** Baixa via motor único. */
  async settle(id: string, input: SettleReceivableInput): Promise<unknown> {
    const { data, error } = await this.supabase.rpc("settle_financial_transaction", {
      _transaction_id: id,
      _payment_method: input.paymentMethod,
      _account_id: input.accountId,
      _paid_at: input.paidAt ?? new Date().toISOString(),
      _notes: input.notes?.trim() ? input.notes.trim() : undefined,
    });
    if (error) throw error;
    await emitAgentEvent({
      type: "finance.receivable.paid",
      ctx: this.ctx,
      payload: { transactionId: id, accountId: input.accountId, method: input.paymentMethod },
    });
    await emitAgentEvent({
      type: "finance.cash.updated",
      ctx: this.ctx,
      payload: { accountId: input.accountId, direction: "in" },
    });
    return data;
  }

  /** Cancelamento — apenas para lançamentos em aberto. */
  async cancel(id: string): Promise<void> {
    const cur = await this.repo.findById(id);
    if (!cur) throw new Error("Conta não encontrada.");
    if (cur.status === "paid") {
      throw new Error("Já liquidada — utilize estorno.");
    }
    const { error } = await this.supabase
      .from("financial_transactions")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("company_id", this.companyId);
    if (error) throw error;
  }

  /** Estorno via motor único. */
  async reverse(id: string, notes?: string): Promise<unknown> {
    const { data, error } = await this.supabase.rpc("reverse_financial_transaction", {
      _transaction_id: id,
      _notes: notes?.trim() ? notes.trim() : undefined,
    });
    if (error) throw error;
    await emitAgentEvent({
      type: "finance.cash.updated",
      ctx: this.ctx,
      payload: { transactionId: id, direction: "reversal" },
    });
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
