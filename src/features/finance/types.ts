import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type FinancialAccount = Tables<"financial_accounts">;
export type FinancialAccountInsert = TablesInsert<"financial_accounts">;
export type FinancialAccountUpdate = TablesUpdate<"financial_accounts">;

export type FinancialCategory = Tables<"financial_categories">;
export type FinancialCategoryInsert = TablesInsert<"financial_categories">;
export type FinancialCategoryUpdate = TablesUpdate<"financial_categories">;

export type CostCenter = Tables<"cost_centers">;
export type CostCenterInsert = TablesInsert<"cost_centers">;

export type FinancialTransaction = Tables<"financial_transactions">;
export type FinancialTransactionInsert = TablesInsert<"financial_transactions">;
export type FinancialTransactionUpdate = TablesUpdate<"financial_transactions">;

export type AccountType = "bank" | "cash" | "digital_wallet";
export type CategoryKind = "income" | "expense";
export type TransactionType = "income" | "expense" | "transfer";
export type TransactionStatus = "pending" | "paid" | "overdue" | "cancelled";
export type TransactionSource = "manual" | "sale" | "purchase" | "bella_pay" | "transfer";

export const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "bank", label: "Conta bancária" },
  { value: "cash", label: "Caixa" },
  { value: "digital_wallet", label: "Carteira digital" },
];

export const TRANSACTION_TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "income", label: "Dinheiro Entrou" },
  { value: "expense", label: "Dinheiro Saiu" },
  { value: "transfer", label: "Transferência" },
];

export const TRANSACTION_STATUS_OPTIONS: { value: TransactionStatus; label: string }[] = [
  { value: "pending", label: "Pendente" },
  { value: "paid", label: "Pago" },
  { value: "overdue", label: "Atrasado" },
  { value: "cancelled", label: "Cancelado" },
];

export const STATIC_FINANCIAL_CATEGORIES = [
  "Equipamentos e Tecnologia",
  "Compra de Mercadorias / Estoque",
  "Embalagens e Material de Uso",
  "Despesas Operacionais / Mão de Obra",
  "Outras Despesas Gerais",
] as const;


/**
 * Forma de recebimento/pagamento da baixa financeira.
 * Mesmo domínio adotado em `credit_payments` e `sales`.
 */
export type FinancePaymentMethod =
  | "cash"
  | "pix"
  | "debit_card"
  | "credit_card"
  | "bella_pay"
  | "bank_transfer"
  | "boleto"
  | "other";

export const FINANCE_PAYMENT_METHOD_OPTIONS: {
  value: FinancePaymentMethod;
  label: string;
}[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "bella_pay", label: "Bella Pay" },
  { value: "bank_transfer", label: "Transferência bancária" },
  { value: "boleto", label: "Boleto" },
  { value: "other", label: "Outro" },
];

export const FINANCE_PAYMENT_METHOD_LABEL: Record<string, string> =
  Object.fromEntries(
    FINANCE_PAYMENT_METHOD_OPTIONS.map((o) => [o.value, o.label]),
  );

export interface SettleTransactionInput {
  paymentMethod: FinancePaymentMethod;
  accountId: string;
  paidAt: string;
  notes?: string | null;
  /**
   * Valor efetivamente liquidado. Quando diferente do valor original do
   * lançamento, a diferença é registrada em `discount_amount`
   * (positivo = desconto concedido, negativo = acréscimo cobrado).
   */
  settledAmount?: number | null;
}


export interface CompleteSettlementInput {
  paymentMethod: FinancePaymentMethod;
  accountId: string;
  notes?: string | null;
}

/** Baixa antiga incompleta (sem forma de recebimento e/ou conta). */
export interface IncompleteSettlement {
  id: string;
  description: string;
  amount: number;
  type: string;
  paid_at: string | null;
  transaction_date: string | null;
  payment_method: string | null;
  account_id: string | null;
  account_name: string | null;
  sale_number: string | null;
  customer_name: string | null;
}

export interface TransactionListFilters {
  search: string;
  type: string;
  status: string;
  accountId: string;
  categoryId: string;
  page: number;
  pageSize: number;
}

export interface TransactionWithMeta extends FinancialTransaction {
  account_name: string | null;
  category_name: string | null;
}

export interface FinanceOverview {
  currentBalance: number;
  receivable: number;
  /** Vencidos: due_date (fallback transaction_date) < hoje da empresa. */
  receivableOverdue: number;
  /** A vencer nos próximos 30 dias (hoje ≤ due_date ≤ hoje+30). */
  receivableDue30: number;
  /** A vencer após 30 dias. */
  receivableDue60Plus: number;
  payable: number;
  projected: number;
  monthIncome: number;
  monthExpense: number;
  /** Recebimentos efetivados hoje (financial_transactions pagos com paid_at = hoje). */
  receiptsToday: number;
  receiptsTodayCount: number;
  /**
   * KPI Home "Dinheiro para entrar" — regra única: financial_transactions
   * de receita com status = 'pending'. Nunca derivado de `sales`.
   */
  pendingReceivable: number;
  pendingReceivableCount: number;

  upcomingIncome: { id: string; description: string; date: string; amount: number }[];
  upcomingExpense: { id: string; description: string; date: string; amount: number }[];
  /** Receita Bruta: somatório das receitas pagas no mês (sem deduzir nada). */
  grossRevenue: number;
  /** Taxas e Deduções: valor retido em taxas de cartão/gateway ou estornos/devoluções pagos no mês. */
  taxesAndDeductions: number;
  /** Lucro operacional direto: receitas pagas - despesas pagas no mês. */
  monthProfit: number;
}
