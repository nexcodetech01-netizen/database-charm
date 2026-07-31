/**
 * PDV — Motor de pagamentos (Sprint 2.6).
 *
 * Camada PURA. Nenhuma regra de pagamento é implementada aqui: o PDV apenas
 * abre o `CheckoutDialog` existente, que já orquestra Bella Pay, Financeiro,
 * Crediário, PIX, cartão, boleto, link e dinheiro (com troco). Este módulo
 * só traduz o resultado do checkout para o estado da sessão do balcão.
 */
import type { FinancePaymentMethod } from "@/features/finance/types";
import type { UiCheckoutMethod } from "../../components/checkout-dialog";

/**
 * Formas habilitadas no balcão — exatamente as do CheckoutDialog.
 * A lista existe só para documentação/asserção; o dialog é a fonte da verdade.
 */
export const PDV_CHECKOUT_METHODS: UiCheckoutMethod[] = [
  "cash",
  "pix",
  "pix_manual",
  "credit_card",
  "debit_card",
  "credit",
  "payment_link",
  "boleto",
];

/** Traduz o método do checkout para a forma financeira usada no recibo. */
export function toFinancePaymentMethod(
  method: UiCheckoutMethod | undefined,
): FinancePaymentMethod {
  switch (method) {
    case "cash":
      return "cash";
    case "pix":
      return "bella_pay";
    case "pix_manual":
      return "pix";
    case "credit_card":
      return "credit_card";
    case "debit_card":
      return "debit_card";
    case "boleto":
      return "boleto";
    case "credit":
    case "payment_link":
      return "other";
    default:
      return "other";
  }
}

/** Troco em tempo real — cálculo puro de apresentação (dinheiro). */
export function pdvChange(total: number, received: number): number {
  const diff = Number(received || 0) - Number(total || 0);
  return diff > 0 ? Number(diff.toFixed(2)) : 0;
}

/** `true` quando o valor recebido cobre o total da venda. */
export function isCashSufficient(total: number, received: number): boolean {
  return Number(received || 0) + 1e-9 >= Number(total || 0);
}

export type PdvPaymentState = {
  /** Venda persistida aguardando pagamento (checkout aberto). */
  checkoutOpen: boolean;
};

/**
 * Resultado do fechamento do checkout sem pagamento confirmado.
 * O carrinho é preservado (rollback do estado do PDV, nunca do banco — a
 * reversão da venda para "draft" é feita pelo próprio CheckoutDialog).
 */
export function resolveCheckoutClose(input: {
  paid: boolean;
}): "completed" | "back-to-cart" {
  return input.paid ? "completed" : "back-to-cart";
}
