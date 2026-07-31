/**
 * lib/payments — semântica das formas de pagamento da venda.
 *
 * Consolida o registro existente (`payment-methods`) com as duas regras
 * de fluxo que hoje estavam escritas inline no formulário:
 *
 * • "a_receber" NÃO abre checkout — é registrada como pendente e o banco
 *   dispara baixa de estoque + Contas a Receber.
 * • Qualquer outra forma, ao finalizar, abre o CheckoutDialog.
 *
 * Comportamento idêntico ao anterior — apenas nomeado e testável.
 */
export {
  PAYMENT_METHOD_REGISTRY,
  isCashPaymentMethod,
} from "./payment-methods";
export type {
  PaymentMethodKind,
  PaymentMethodDescriptor,
} from "./payment-methods";

/** Forma de pagamento que registra a venda como Contas a Receber. */
export const RECEIVABLE_PAYMENT_METHOD = "a_receber";

/** `true` quando a venda é "A Receber" (sem checkout). */
export function isReceivablePaymentMethod(
  method: string | null | undefined,
): boolean {
  return (method ?? "").trim() === RECEIVABLE_PAYMENT_METHOD;
}

/**
 * `true` quando a finalização deve abrir o Checkout.
 * Só é verdadeiro em finalização e fora do fluxo "A Receber".
 */
export function requiresCheckout(
  method: string | null | undefined,
  finalize: boolean,
): boolean {
  return finalize && !isReceivablePaymentMethod(method);
}
