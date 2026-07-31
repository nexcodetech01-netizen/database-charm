/**
 * FIN-002 — Derivações UX-only para Contas a Receber/Pagar.
 * Sem alterações em banco, services ou repositories.
 *
 * Estados exibidos ao lojista (5 apenas):
 *   🟢 paid       → status = 'paid'
 *   🟡 partial    → derivado por grupo (reference_id) com mistura pago/pendente
 *   🔵 scheduled  → pending com vencimento no futuro (> hoje)
 *   🟠 pending    → pending com vencimento hoje ou sem vencimento
 *   🔴 overdue    → pending/overdue com vencimento < hoje
 */
import type { TransactionWithMeta } from "../types";

export type DisplayStatus =
  | "paid"
  | "partial"
  | "scheduled"
  | "pending"
  | "overdue"
  | "cancelled";

export const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  paid: "Pago",
  partial: "Parcial",
  scheduled: "Agendado",
  pending: "Pendente",
  overdue: "Vencido",
  cancelled: "Cancelado",
};

export const DISPLAY_STATUS_TONE: Record<DisplayStatus, string> = {
  paid: "bg-success/10 text-success border-success/20",
  partial: "bg-warning/10 text-warning border-warning/20",
  scheduled: "bg-primary/10 text-primary border-primary/20",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border line-through",
};

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Estado individual, sem contexto de grupo.
 */
export function deriveRowStatus(t: TransactionWithMeta): DisplayStatus {
  if (t.status === "paid") return "paid";
  if (t.status === "cancelled") return "cancelled";
  const today = startOfToday();
  const due = t.due_date
    ? new Date(t.due_date + "T00:00:00").getTime()
    : null;
  if (due != null && due < today) return "overdue";
  if (due != null && due > today) return "scheduled";
  return "pending";
}

/**
 * Estado agrupado por reference_id (venda/compra origem).
 * Se o grupo tem parcelas pagas e pendentes → 'partial'.
 */
export function deriveGroupStatus(
  t: TransactionWithMeta,
  groups: Map<string, TransactionWithMeta[]>,
): DisplayStatus {
  if (!t.reference_id) return deriveRowStatus(t);
  const siblings = groups.get(t.reference_id);
  if (!siblings || siblings.length <= 1) return deriveRowStatus(t);
  const paid = siblings.filter((s) => s.status === "paid").length;
  const pending = siblings.length - paid;
  if (paid > 0 && pending > 0) return "partial";
  return deriveRowStatus(t);
}

export function groupByReference(
  rows: TransactionWithMeta[],
): Map<string, TransactionWithMeta[]> {
  const map = new Map<string, TransactionWithMeta[]>();
  for (const r of rows) {
    if (!r.reference_id) continue;
    const arr = map.get(r.reference_id) ?? [];
    arr.push(r);
    map.set(r.reference_id, arr);
  }
  return map;
}

export function daysOverdue(t: TransactionWithMeta): number {
  if (!t.due_date) return 0;
  const today = startOfToday();
  const due = new Date(t.due_date + "T00:00:00").getTime();
  const diff = today - due;
  if (diff <= 0) return 0;
  return Math.floor(diff / 86_400_000);
}

/**
 * Resumo financeiro do grupo (venda/compra) ou da linha individual.
 */
export interface ReceivableSummary {
  original: number;
  received: number;
  balance: number;
  dueDate: string | null;
  daysOverdue: number;
  status: DisplayStatus;
  installments: { total: number; paid: number };
}

export function summarize(
  t: TransactionWithMeta,
  siblings: TransactionWithMeta[] | null,
): ReceivableSummary {
  const list = siblings && siblings.length > 0 ? siblings : [t];
  const original = list.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const received = list
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const balance = Math.max(0, original - received);
  const paidCount = list.filter((r) => r.status === "paid").length;

  // status do grupo
  let status: DisplayStatus;
  if (balance <= 0.001) status = "paid";
  else if (paidCount > 0) status = "partial";
  else status = deriveRowStatus(t);

  return {
    original,
    received,
    balance,
    dueDate: t.due_date,
    daysOverdue: daysOverdue(t),
    status,
    installments: { total: list.length, paid: paidCount },
  };
}
