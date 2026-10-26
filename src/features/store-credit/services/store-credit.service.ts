import { supabase } from "@/integrations/supabase/client";

/** Lançamento do extrato de vale-troca da cliente. */
export interface StoreCreditEntry {
  id: string;
  amount: number;
  kind: "exchange" | "sale_use" | "sale_cancel" | "adjustment";
  sale_id: string | null;
  return_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface ExchangeInput {
  companyId: string;
  saleId: string;
  /** Obrigatória quando a venda original não tem cliente. */
  customerId?: string | null;
  reason: string;
  notes?: string | null;
  items: {
    sale_item_id: string;
    product_id: string | null;
    description: string;
    quantity: number;
  }[];
  clientRequestId?: string;
}

export interface ExchangeResult {
  return_id: string;
  customer_id: string;
  credit: number;
  balance: number;
}

// Tabela/funções novas (migration 20261026210000); tipos ainda não gerados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const storeCreditService = {
  /** Saldo; null se o SQL do vale-troca ainda não foi rodado. */
  async balance(customerId: string): Promise<number | null> {
    const { data, error } = await db.rpc("customer_store_credit_balance", {
      _customer_id: customerId,
    });
    if (error) return null;
    return Number(data ?? 0);
  },

  async entries(customerId: string): Promise<StoreCreditEntry[]> {
    const { data, error } = await db
      .from("customer_store_credit_entries")
      .select("id, amount, kind, sale_id, return_id, notes, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return [];
    return (data ?? []).map((r: StoreCreditEntry) => ({ ...r, amount: Number(r.amount) }));
  },

  /** Troca: peças voltam ao estoque e a cliente ganha vale-troca. */
  async exchange(input: ExchangeInput): Promise<ExchangeResult> {
    const { data, error } = await db.rpc("create_sale_exchange", {
      _input: {
        company_id: input.companyId,
        sale_id: input.saleId,
        customer_id: input.customerId ?? null,
        reason: input.reason,
        notes: input.notes ?? null,
        client_request_id: input.clientRequestId ?? globalThis.crypto?.randomUUID?.() ?? null,
        items: input.items,
      },
    });
    if (error) {
      if (/create_sale_exchange|could not find the function/i.test(error.message)) {
        throw new Error("Falta rodar o SQL do vale-troca no Supabase.");
      }
      throw new Error(error.message);
    }
    const r = data as ExchangeResult;
    return { ...r, credit: Number(r.credit ?? 0), balance: Number(r.balance ?? 0) };
  },

  /** Conclui venda paga 100% com vale-troca (total zero). */
  async paySaleWithCredit(saleId: string): Promise<void> {
    const { error } = await db.rpc("pay_sale_with_store_credit", { _sale_id: saleId });
    if (error) throw new Error(error.message);
  },
};
