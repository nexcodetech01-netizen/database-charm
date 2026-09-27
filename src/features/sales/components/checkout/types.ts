import type { CheckoutMethod } from "../../types";

/** UI-only: "boleto" reaproveita o fluxo de link (billingType UNDEFINED). */
export type UiCheckoutMethod = CheckoutMethod | "boleto";

export type BillingType = "PIX" | "CREDIT_CARD" | "UNDEFINED";

/** Linha de `bella_pay_charges` usada pelo checkout. */
export interface ChargeRow {
  id: string;
  status: string;
  invoice_url: string | null;
  payment_link: string | null;
  pix_qr_code: string | null;
  pix_payload: string | null;
  billing_type: string;
}

/** Status do Asaas que significam pagamento recebido. */
export const RECEIVED_CHARGE_STATUSES: ReadonlySet<string> = new Set([
  "RECEIVED",
  "CONFIRMED",
  "RECEIVED_IN_CASH",
]);

export function isChargeReceived(status: string | null | undefined): boolean {
  return RECEIVED_CHARGE_STATUSES.has(String(status));
}
