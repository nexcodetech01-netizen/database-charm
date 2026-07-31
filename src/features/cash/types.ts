import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type CashSession = Tables<"cash_sessions">;
export type CashSessionInsert = TablesInsert<"cash_sessions">;
export type CashMovement = Tables<"cash_movements">;
export type CashMovementInsert = TablesInsert<"cash_movements">;

export type CashSessionStatus = "open" | "closed";
export type CashMovementType = "cash_in" | "cash_out";

export type CashPaymentMethodKey =
  | "cash"
  | "pix"
  | "credit_card"
  | "debit_card"
  | "payment_link";

export const CASH_METHOD_LABEL: Record<CashPaymentMethodKey, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  credit_card: "Crédito",
  debit_card: "Débito",
  payment_link: "Link",
};

export interface CashByMethod {
  cash: { count: number; total: number };
  pix: { count: number; total: number };
  credit_card: { count: number; total: number };
  debit_card: { count: number; total: number };
  payment_link: { count: number; total: number };
  other: { count: number; total: number };
}

export interface CashSaleEntry {
  id: string;
  number?: string | null;
  paid_at: string | null;
  payment_method: string | null;
  grand_total: number;
  /** Venda de teste — NF-e emitida em homologação. */
  is_test?: boolean;
}

/** Bloco B — baixa financeira ocorrida dentro da janela da sessão. */
export interface CashReceiptEntry {
  id: string;
  description: string | null;
  amount: number;
  payment_method: string | null;
  paid_at: string | null;
  source: string | null;
  /** Recebimento vinculado a uma venda de teste (homologação). */
  is_test?: boolean;
}

export interface CashSummary {
  openingBalance: number;
  /** Bloco C — suprimentos manuais (exclui "Baixa financeira"). */
  cashIn: number;
  /** Bloco C — sangrias manuais (exclui "Baixa financeira"). */
  cashOut: number;
  /** Bloco A — vendas da sessão pagas em dinheiro físico. */
  cashSales: number;
  /** Bloco B — recebimentos da sessão em dinheiro físico. */
  cashReceipts: number;
  /** Bloco B — pagamentos (despesas) liquidados na sessão em dinheiro físico. */
  cashPayments: number;
  /** openingBalance + cashSales + cashReceipts - cashPayments + cashIn - cashOut */
  expectedCash: number;
  salesCount: number;
  salesTotal: number;   // Bloco A — todas as formas
  byMethod: CashByMethod;
  /** Bloco B — recebimentos na sessão (exclui vendas do bloco A). */
  receipts: CashReceiptEntry[];
  receiptsTotal: number;
  receiptsByMethod: CashByMethod;
  /** Bloco C — todos os movimentos da sessão. */
  movements: CashMovement[];
  manualMovements: CashMovement[];
  /** Movimentos gerados por baixa financeira — informativos. */
  settlementMovements: CashMovement[];
  settlementMovementsTotal: number;
  sales: CashSaleEntry[];
  /** Total das vendas de produção da sessão. */
  salesTotalProduction: number;
  /** Total das vendas de teste (homologação) da sessão. */
  salesTotalTest: number;
  /** Produção + homologação. */
  salesTotalAll: number;
  testSalesCount: number;
  /** Movimentações originadas de vendas de teste. */
  testMovementIds: string[];
}


export interface OpenSessionInput {
  companyId: string;
  operatorId: string;
  operatorName: string | null;
  openingBalance: number;
  openingNote?: string | null;
}

export interface CloseSessionInput {
  sessionId: string;
  countedCash: number;
  closingNote?: string | null;
}

export interface RegisterMovementInput {
  sessionId: string;
  companyId: string;
  createdBy: string | null;
  type: CashMovementType;
  amount: number;
  reason: string;
  note?: string | null;
}

export function emptyByMethod(): CashByMethod {
  return {
    cash: { count: 0, total: 0 },
    pix: { count: 0, total: 0 },
    credit_card: { count: 0, total: 0 },
    debit_card: { count: 0, total: 0 },
    payment_link: { count: 0, total: 0 },
    other: { count: 0, total: 0 },
  };
}
