import type { Tables } from "@/integrations/supabase/types";

export type CreditAccount = Tables<"credit_accounts">;
export type CreditInstallment = Tables<"credit_installments">;
export type CreditPayment = Tables<"credit_payments">;
export type CreditSummary = Tables<"sale_credit_summary">;

export type CreditAccountStatus =
  | "open"
  | "partially_paid"
  | "settled"
  | "cancelled";

export const CREDIT_ACCOUNT_STATUS_LABEL: Record<CreditAccountStatus, string> = {
  open: "Em aberto",
  partially_paid: "Parcialmente pago",
  settled: "Quitado",
  cancelled: "Cancelado",
};

export interface CreditAccountDetail {
  account: CreditAccount;
  installments: CreditInstallment[];
  payments: CreditPayment[];
}

/** Métodos aceitos para receber entrada / parcelas de crediário. */
export const CREDIT_PAYMENT_METHOD_OPTIONS: {
  value: string;
  label: string;
}[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix_manual", label: "PIX Próprio" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "transfer", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "other", label: "Outro" },
];
