/**
 * Como a lista de vendas mostra o pagamento (decisão de 08/10/2026).
 *
 * Antes havia 3 selos para "dinheiro que ainda não entrou" (Pendente,
 * Parcialmente paga, Pendente + Pagamento Pendente). Agora é um selo só,
 * "A receber" — ou "Vencido" quando passou da data combinada — e o detalhe
 * (crediário, pago parcial, sem forma de pagamento) vai numa linha abaixo.
 * O status gravado no banco não muda.
 */

export type ReceivableBadge = "paid" | "receivable" | "overdue" | "draft" | "cancelled";

export interface ReceivableInput {
  status: string;
  grandTotal: number;
  paymentMethod: string | null;
  /** Quanto falta (crediário ou títulos pendentes). null = desconhecido. */
  remaining: number | null;
  /** Próximo vencimento em aberto (YYYY-MM-DD). */
  nextDue: string | null;
  isCredit: boolean;
}

export interface ReceivableView {
  badge: ReceivableBadge;
  /** Linha pequena abaixo do valor; null quando não há o que dizer. */
  detail: string | null;
}

const OPEN = new Set(["pending", "partially_paid"]);

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function receivableView(input: ReceivableInput, today = todayISO()): ReceivableView {
  if (input.status === "paid" || input.status === "completed" || input.status === "invoiced") {
    return { badge: "paid", detail: null };
  }
  if (input.status === "cancelled") return { badge: "cancelled", detail: null };
  if (!OPEN.has(input.status)) return { badge: "draft", detail: null };

  const overdue = !!input.nextDue && input.nextDue < today;
  const remaining = input.remaining ?? input.grandTotal;
  const paid = Math.max(0, input.grandTotal - remaining);
  const parts: string[] = [];

  if (input.isCredit) parts.push("crediário");
  else if (!input.paymentMethod || input.paymentMethod === "a_receber") parts.push("sem forma de pagamento");

  if (paid > 0.004) parts.push(`pago ${brl(paid)}`);

  if (input.nextDue) parts.push(overdue ? `venceu ${ddmm(input.nextDue)}` : `vence ${ddmm(input.nextDue)}`);

  parts.push(`falta ${brl(remaining)}`);

  return { badge: overdue ? "overdue" : "receivable", detail: parts.join(" · ") };
}
