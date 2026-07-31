/**
 * Finance v2 — Tipos públicos (Sprint 006).
 *
 * Reutiliza o schema atual (`financial_*`, `cash_movements`) — NÃO cria
 * novas tabelas. Baixa/estorno passam OBRIGATORIAMENTE pelas RPCs oficiais
 * (`settle_financial_transaction`, `reverse_financial_transaction`).
 */
import type { Tables } from "@/integrations/supabase/types";

export type FinancialTransactionRow = Tables<"financial_transactions">;
export type FinancialAccountRow = Tables<"financial_accounts">;
export type FinancialCategoryRow = Tables<"financial_categories">;
export type CostCenterRow = Tables<"cost_centers">;

/** Status "lógicos" v2 mapeados para o enum do banco + regras temporais. */
export type FinanceEntryStatus =
  | "pending"
  | "partial"
  | "paid"
  | "overdue"
  | "cancelled";

export interface CreateReceivableInput {
  customerId?: string | null;
  saleId?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  description: string;
  amount: number;
  dueDate?: string | null;
  transactionDate?: string | null;
  interest?: number | null;
  fine?: number | null;
  discount?: number | null;
  notes?: string | null;
  installments?: number | null;
  installmentIntervalDays?: number | null;
}

export interface CreatePayableInput {
  supplierId?: string | null;
  purchaseId?: string | null;
  categoryId?: string | null;
  costCenterId?: string | null;
  accountId?: string | null;
  description: string;
  amount: number;
  dueDate?: string | null;
  transactionDate?: string | null;
  notes?: string | null;
}

export interface EntrySummary {
  id: string;
  description: string;
  amount: number;
  status: FinanceEntryStatus;
  dbStatus: string;
  dueDate: string | null;
  paidAt: string | null;
  accountId: string | null;
  accountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  counterpartyName: string | null;
  source: string;
}

export interface CashPositionSnapshot {
  totalBalance: number;
  perAccount: Array<{ id: string; name: string; balance: number; type: string }>;
}

export interface CashFlowProjectionDay {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
  runningBalance: number;
}

export interface CashFlowProjection {
  startingBalance: number;
  horizonDays: number;
  totalInflow: number;
  totalOutflow: number;
  endingBalance: number;
  days: CashFlowProjectionDay[];
}

export interface ProLaboreRecommendation {
  monthIncome: number;
  monthExpense: number;
  netMonth: number;
  currentBalance: number;
  reserveTarget: number;
  suggestedMax: number;
  safe: boolean;
  reason: string;
}

export interface FinanceSummary {
  currentBalance: number;
  totalReceivable: number;
  totalPayable: number;
  receivableOverdue: number;
  payableOverdue: number;
  receiptsToday: number;
  projected30d: number;
}

export function deriveEntryStatus(
  row: Pick<FinancialTransactionRow, "status" | "due_date">,
  today: Date = new Date(),
): FinanceEntryStatus {
  if (row.status === "paid") return "paid";
  if (row.status === "cancelled") return "cancelled";
  if (!row.due_date) return "pending";
  const due = new Date(`${row.due_date}T00:00:00`);
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  if (due.getTime() < t.getTime()) return "overdue";
  return "pending";
}
