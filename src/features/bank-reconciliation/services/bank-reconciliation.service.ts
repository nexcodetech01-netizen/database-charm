import { supabase } from "@/integrations/supabase/client";
import type { Direction } from "../lib/nubank-statement";
import type { SystemMove } from "../lib/match";

// Tabelas novas ainda fora dos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface StoredLine {
  id: string;
  line_hash: string;
  entry_date: string;
  direction: Direction;
  amount: number;
  description: string | null;
  counterparty: string | null;
  status: "matched" | "created" | "ignored";
  transaction_id: string | null;
  transfer_id: string | null;
}

export interface NewLine {
  line_hash: string;
  entry_date: string;
  direction: Direction;
  amount: number;
  description: string;
  counterparty: string;
  status: StoredLine["status"];
  transaction_id?: string | null;
  transfer_id?: string | null;
}

export interface AccountMoves {
  moves: (SystemMove & { paymentMethod: string | null })[];
}

const TZ = "America/Sao_Paulo";

/** Dia (yyyy-mm-dd) em São Paulo de um instante ISO. */
export function spDay(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const bankReconciliationService = {
  /** Movimentos pagos/transferências da conta a partir de `fromDay` (inclusive). */
  async loadMoves(companyId: string, accountId: string, fromDay: string) {
    const [txRes, trRes] = await Promise.all([
      db
        .from("financial_transactions")
        .select("id, type, amount, paid_at, description, source, payment_method")
        .eq("company_id", companyId)
        .eq("account_id", accountId)
        .eq("status", "paid")
        .gte("paid_at", `${fromDay}T00:00:00-03:00`)
        .order("paid_at", { ascending: true })
        .limit(2000),
      db
        .from("financial_transfers")
        .select("id, from_account_id, to_account_id, amount, transfer_date, description")
        .eq("company_id", companyId)
        .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
        .gte("transfer_date", fromDay)
        .limit(1000),
    ]);
    if (txRes.error) throw txRes.error;
    if (trRes.error) throw trRes.error;

    const moves: (SystemMove & { paymentMethod: string | null })[] = [];
    for (const t of txRes.data ?? []) {
      if (!t.paid_at) continue;
      moves.push({
        id: t.id,
        kind: "transaction",
        date: spDay(t.paid_at),
        direction: t.type === "income" ? "in" : "out",
        amount: Math.abs(Number(t.amount) || 0),
        description: t.description ?? "",
        source: t.source ?? null,
        paymentMethod: t.payment_method ?? null,
      });
    }
    for (const f of trRes.data ?? []) {
      moves.push({
        id: f.id,
        kind: "transfer",
        date: f.transfer_date,
        direction: f.to_account_id === accountId ? "in" : "out",
        amount: Math.abs(Number(f.amount) || 0),
        description: f.description || "Transferência entre contas",
        source: "transfer",
        paymentMethod: null,
      });
    }
    return moves;
  },

  async loadLines(accountId: string, fromDay: string): Promise<StoredLine[]> {
    const { data, error } = await db
      .from("bank_statement_lines")
      .select("*")
      .eq("account_id", accountId)
      .gte("entry_date", addDays(fromDay, -10))
      .limit(5000);
    if (error) throw error;
    return (data ?? []) as StoredLine[];
  },

  async saveLines(companyId: string, accountId: string, lines: NewLine[]) {
    if (lines.length === 0) return;
    const { error } = await db.from("bank_statement_lines").upsert(
      lines.map((l) => ({
        ...l,
        company_id: companyId,
        account_id: accountId,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "account_id,line_hash" },
    );
    if (error) throw error;
  },

  async removeLine(accountId: string, lineHash: string) {
    const { error } = await db
      .from("bank_statement_lines")
      .delete()
      .eq("account_id", accountId)
      .eq("line_hash", lineHash);
    if (error) throw error;
  },

  async lastMark(
    accountId: string,
  ): Promise<{ reconciled_until: string; statement_balance: number | null } | null> {
    const { data, error } = await db
      .from("bank_reconciliation_marks")
      .select("reconciled_until, statement_balance")
      .eq("account_id", accountId)
      .order("reconciled_until", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null; // tabela ainda não criada
    return data ?? null;
  },

  async addMark(input: {
    companyId: string;
    accountId: string;
    reconciledUntil: string;
    statementBalance: number | null;
    systemBalance: number | null;
  }) {
    const { error } = await db.from("bank_reconciliation_marks").insert({
      company_id: input.companyId,
      account_id: input.accountId,
      reconciled_until: input.reconciledUntil,
      statement_balance: input.statementBalance,
      system_balance: input.systemBalance,
    });
    if (error) throw error;
  },
};
