/**
 * P1-05 — Mapa oficial de eventos Asaas → ação interna.
 * Módulo puro.
 */
import type { ChargeStatus } from "./status-machine";

export type AsaasEvent =
  | "PAYMENT_CREATED"
  | "PAYMENT_UPDATED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_RESTORED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_DELETED"
  | "PAYMENT_CHARGEBACK_REQUESTED"
  | "PAYMENT_CHARGEBACK_DISPUTE"
  | "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
  | "PAYMENT_DUNNING_RECEIVED"
  | "PAYMENT_DUNNING_REQUESTED";

export interface EventAction {
  /** Status alvo, se houver. */
  status?: ChargeStatus;
  /** Se true, faz a baixa financeira (apenas PAYMENT_RECEIVED). */
  settleFinance?: boolean;
  /** Marca a cobrança como cancelada (canceled_at). */
  markCanceled?: boolean;
  /** Marca a cobrança como paga (paid_at). */
  markPaid?: boolean;
  /** Ignorar evento (registrar, não alterar status). */
  ignore?: boolean;
}

const MAP: Record<AsaasEvent, EventAction> = {
  PAYMENT_CREATED: { status: "PENDING" },
  PAYMENT_UPDATED: {}, // sem transição forçada; log apenas
  // Asaas envia PAYMENT_CONFIRMED assim que o pagamento é confirmado pelo cliente
  // (autorização no cartão de crédito; confirmação bancária no boleto). O valor
  // ainda não caiu em conta, mas para o negócio a venda já foi paga — sem isso
  // vendas no cartão ficavam "Pendente" até a liquidação (D+30) enviar
  // PAYMENT_RECEIVED. Fazemos a baixa aqui e o PAYMENT_RECEIVED subsequente
  // fica idempotente (RECEIVED→RECEIVED permitido; RPC não recria FT nem
  // repromove venda já 'paid').
  PAYMENT_CONFIRMED: { status: "CONFIRMED", settleFinance: true, markPaid: true },
  PAYMENT_RECEIVED: { status: "RECEIVED", settleFinance: true, markPaid: true },
  PAYMENT_OVERDUE: { status: "OVERDUE" },
  PAYMENT_RESTORED: { status: "PENDING" },
  PAYMENT_REFUNDED: { status: "REFUNDED", markCanceled: true },
  PAYMENT_DELETED: { status: "CANCELED", markCanceled: true },
  PAYMENT_CHARGEBACK_REQUESTED: { status: "CHARGEBACK" },
  PAYMENT_CHARGEBACK_DISPUTE: { status: "CHARGEBACK" },
  PAYMENT_AWAITING_CHARGEBACK_REVERSAL: { status: "CHARGEBACK" },
  PAYMENT_DUNNING_RECEIVED: { status: "DUNNING" },
  PAYMENT_DUNNING_REQUESTED: { status: "DUNNING" },
};

const KNOWN = new Set(Object.keys(MAP) as AsaasEvent[]);

export function isKnownEvent(evt: string): evt is AsaasEvent {
  return KNOWN.has(evt as AsaasEvent);
}

export function resolveEventAction(evt: string): EventAction {
  return isKnownEvent(evt) ? MAP[evt] : { ignore: true };
}
