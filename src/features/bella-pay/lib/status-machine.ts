/**
 * P1-06 — Máquina de estados de Bella Pay Charge.
 * Módulo puro (sem side-effects). Testável em isolamento.
 */

export type ChargeStatus =
  | "PENDING"
  | "AWAITING_RISK_ANALYSIS"
  | "CONFIRMED"
  | "RECEIVED"
  | "OVERDUE"
  | "REFUNDED"
  | "CHARGEBACK"
  | "DUNNING"
  | "CANCELED";

const TRANSITIONS: Record<ChargeStatus, ReadonlySet<ChargeStatus>> = {
  PENDING: new Set([
    "AWAITING_RISK_ANALYSIS",
    "CONFIRMED",
    "RECEIVED",
    "OVERDUE",
    "CANCELED",
  ]),
  AWAITING_RISK_ANALYSIS: new Set([
    "CONFIRMED",
    "RECEIVED",
    "OVERDUE",
    "CANCELED",
  ]),
  CONFIRMED: new Set(["RECEIVED", "REFUNDED", "CHARGEBACK", "CANCELED"]),
  RECEIVED: new Set(["REFUNDED", "CHARGEBACK", "DUNNING"]),
  OVERDUE: new Set(["CONFIRMED", "RECEIVED", "PENDING", "CANCELED"]),
  REFUNDED: new Set([]),
  CHARGEBACK: new Set(["REFUNDED"]),
  DUNNING: new Set(["RECEIVED", "REFUNDED"]),
  CANCELED: new Set([]),
};

const KNOWN = new Set(Object.keys(TRANSITIONS) as ChargeStatus[]);

export function isChargeStatus(v: unknown): v is ChargeStatus {
  return typeof v === "string" && KNOWN.has(v as ChargeStatus);
}

/** Retorna true se a transição é permitida. Idêntico (from == to) é aceito (idempotente). */
export function canTransition(
  from: ChargeStatus | null | undefined,
  to: ChargeStatus,
): boolean {
  if (!from) return true; // primeira atribuição
  if (from === to) return true;
  return TRANSITIONS[from]?.has(to) ?? false;
}
