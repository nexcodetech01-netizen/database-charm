/**
 * FIN-004 — Conciliação Financeira Inteligente (presentation only).
 *
 * A conciliação já é executada automaticamente pelo backend
 * (`bella_pay_apply_webhook_result` + trigger `apply_sale_to_finance`).
 * Este módulo apenas DERIVA, no cliente, quais cobranças precisam de
 * atenção humana — sem alterar Application Layer, Repositories, Banco,
 * Triggers, Edge Functions, Bella Pay, Pricing Engine ou RBAC.
 */

import type { BellaPayChargeWithMeta } from "@/features/bella-pay/types";

export type ReconciliationIssue =
  | "paid_not_linked"
  | "value_mismatch"
  | "overdue";

export interface ReconciliationRow {
  charge: BellaPayChargeWithMeta;
  issue: ReconciliationIssue;
  expected: number;
  received: number;
  diff: number;
}

export interface ReconciliationSummary {
  autoReconciledToday: number;
  pendingCount: number;
  divergenceCount: number;
  overdueCount: number;
  totalDiff: number;
}

const RECEIVED = new Set(["RECEIVED", "CONFIRMED"]);

function toNumber(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : (v ?? 0);
  return Number.isFinite(n) ? Number(n) : 0;
}

function isSameDay(iso: string | null, ref = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

/** Uma cobrança é "auto-conciliada" quando o webhook do Asaas já vinculou
 *  a transação financeira correspondente. */
export function isAutoReconciled(c: BellaPayChargeWithMeta): boolean {
  return RECEIVED.has(String(c.status)) && !!c.financial_transaction_id;
}

/** Divergência de valor: valor original ≠ valor efetivamente cobrado
 *  (ex.: desconto aplicado no gateway, juros de atraso). */
export function classify(c: BellaPayChargeWithMeta): ReconciliationIssue | null {
  const value = toNumber(c.value);
  const original = c.original_value != null ? toNumber(c.original_value) : null;
  const paid = Boolean(c.paid_at);
  const linked = Boolean(c.financial_transaction_id);

  if (paid && !linked) return "paid_not_linked";
  if (original != null && Math.abs(original - value) > 0.01) return "value_mismatch";
  if (String(c.status) === "OVERDUE") return "overdue";
  return null;
}

export function derivePendencies(
  charges: BellaPayChargeWithMeta[],
): ReconciliationRow[] {
  const out: ReconciliationRow[] = [];
  for (const c of charges) {
    const issue = classify(c);
    if (!issue) continue;
    const expected = toNumber(c.original_value ?? c.value);
    const received = toNumber(c.value);
    out.push({
      charge: c,
      issue,
      expected,
      received,
      diff: Math.abs(expected - received),
    });
  }
  // Prioriza divergências > pagas sem vínculo > vencidas
  const rank: Record<ReconciliationIssue, number> = {
    value_mismatch: 0,
    paid_not_linked: 1,
    overdue: 2,
  };
  return out.sort((a, b) => rank[a.issue] - rank[b.issue]);
}

export function summarize(
  charges: BellaPayChargeWithMeta[],
): ReconciliationSummary {
  const pendencies = derivePendencies(charges);
  return {
    autoReconciledToday: charges.filter(
      (c) => isAutoReconciled(c) && isSameDay(c.paid_at),
    ).length,
    pendingCount: pendencies.filter((p) => p.issue === "paid_not_linked").length,
    divergenceCount: pendencies.filter((p) => p.issue === "value_mismatch").length,
    overdueCount: pendencies.filter((p) => p.issue === "overdue").length,
    totalDiff: pendencies
      .filter((p) => p.issue === "value_mismatch")
      .reduce((acc, p) => acc + p.diff, 0),
  };
}

export const ISSUE_LABEL: Record<ReconciliationIssue, string> = {
  paid_not_linked: "Conciliação pendente",
  value_mismatch: "Diferença encontrada",
  overdue: "Vencida",
};

export const ISSUE_TONE: Record<ReconciliationIssue, string> = {
  paid_not_linked: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  value_mismatch: "border-destructive/30 bg-destructive/10 text-destructive",
  overdue: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

/** Origem legível a partir do `billing_type` (PIX / Cartão / Boleto / Link). */
export function originLabel(c: BellaPayChargeWithMeta): string {
  switch (String(c.billing_type)) {
    case "PIX":
      return "Asaas · PIX";
    case "CREDIT_CARD":
      return "Asaas · Cartão";
    case "BOLETO":
      return "Asaas · Boleto";
    case "UNDEFINED":
      return "Asaas · Link";
    default:
      return `Asaas · ${c.billing_type}`;
  }
}
