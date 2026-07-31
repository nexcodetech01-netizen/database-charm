import { supabase } from "@/integrations/supabase/client";
import type {
  CreditAccount,
  CreditAccountDetail,
  CreditInstallment,
  CreditPayment,
  CreditSummary,
} from "../types";

export interface CreateCreditSaleInput {
  companyId: string;
  saleId: string;
  customerId?: string | null;
  downPayment: number;
  downPaymentMethod?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  clientRequestId?: string;
}

export interface ReceiveCreditPaymentInput {
  companyId: string;
  creditAccountId: string;
  amount: number;
  paymentMethod: string;
  /** Instante da liquidação. Quando omitido, a RPC usa o horário real (now()). */
  paidAt?: string;
  /** Conta financeira de destino. Quando omitida, a RPC resolve pela forma de pagamento. */
  accountId?: string | null;
  notes?: string | null;
  clientRequestId?: string;
}

export const creditService = {
  /** Retorna a conta de crediário vinculada a uma venda (se existir). */
  async getAccountBySale(saleId: string): Promise<CreditAccount | null> {
    const { data, error } = await supabase
      .from("credit_accounts")
      .select("*")
      .eq("sale_id", saleId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getDetail(saleId: string): Promise<CreditAccountDetail | null> {
    const account = await this.getAccountBySale(saleId);
    if (!account) return null;
    const [{ data: installments, error: e1 }, { data: payments, error: e2 }] =
      await Promise.all([
        supabase
          .from("credit_installments")
          .select("*")
          .eq("credit_account_id", account.id)
          .order("sequence", { ascending: true }),
        supabase
          .from("credit_payments")
          .select("*")
          .eq("credit_account_id", account.id)
          .order("paid_at", { ascending: false }),
      ]);
    if (e1) throw e1;
    if (e2) throw e2;
    return {
      account,
      installments: (installments ?? []) as CreditInstallment[],
      payments: (payments ?? []) as CreditPayment[],
    };
  },

  /** Resumo de crediário por cliente — soma via view sale_credit_summary. */
  async getCustomerSummary(customerId: string) {
    const { data, error } = await supabase
      .from("sale_credit_summary")
      .select("*")
      .eq("customer_id", customerId)
      .order("opened_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as CreditSummary[];
    const totals = rows.reduce(
      (acc, r) => {
        const balance = Number(r.balance ?? 0);
        const original = Number(r.original_amount ?? 0);
        const down = Number(r.down_payment ?? 0);
        const received = Number(r.total_received_installments ?? 0);
        acc.original += original;
        acc.balance += balance;
        acc.received += down + received;
        if (r.status === "open" || r.status === "partially_paid") {
          acc.openAccounts += 1;
        }
        const dueDate = r.next_due_date ?? r.due_date;
        if (
          dueDate &&
          (r.status === "open" || r.status === "partially_paid") &&
          new Date(dueDate + "T23:59:59") < new Date()
        ) {
          acc.overdueAmount += balance;
          acc.overdueAccounts += 1;
        }
        return acc;
      },
      {
        original: 0,
        balance: 0,
        received: 0,
        openAccounts: 0,
        overdueAccounts: 0,
        overdueAmount: 0,
      },
    );
    return { rows, totals };
  },

  async createCreditSale(input: CreateCreditSaleInput) {
    const { data, error } = await supabase.rpc("create_credit_sale", {
      _input: {
        company_id: input.companyId,
        sale_id: input.saleId,
        customer_id: input.customerId ?? null,
        down_payment: input.downPayment,
        down_payment_method: input.downPaymentMethod ?? null,
        due_date: input.dueDate ?? null,
        notes: input.notes ?? null,
        client_request_id: input.clientRequestId ?? null,
      },
    });
    if (error) throw error;
    return data as {
      credit_account_id: string;
      installment_id?: string | null;
      down_payment_id?: string | null;
      financial_transaction_id?: string | null;
      balance: number;
      idempotent: boolean;
    };
  },

  async receivePayment(input: ReceiveCreditPaymentInput) {
    const { data, error } = await supabase.rpc("receive_credit_payment", {
      _input: {
        company_id: input.companyId,
        credit_account_id: input.creditAccountId,
        amount: input.amount,
        payment_method: input.paymentMethod,
        paid_at: input.paidAt ?? null,
        account_id: input.accountId ?? null,
        notes: input.notes ?? null,
        client_request_id: input.clientRequestId ?? null,
      },
    });
    if (error) throw error;
    return data as {
      payment_id: string;
      financial_transaction_id: string | null;
      balance: number;
      settled: boolean;
      idempotent: boolean;
    };
  },
};
