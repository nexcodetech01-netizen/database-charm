/**
 * Registro central das formas de pagamento aceitas no PDV com o atributo
 * `kind` — "cash" (à vista) ou "deferred" (a prazo / com liquidação futura).
 *
 * Fonte única de verdade para regras que precisam saber se uma forma de
 * pagamento é à vista, sem comparar rótulos ("PIX", "PIX Próprio", ...).
 * Espelha o `METHODS` renderizado no CheckoutDialog — mantenha as duas
 * listas alinhadas.
 */
export type PaymentMethodKind = "cash" | "deferred";

export interface PaymentMethodDescriptor {
  /** Identificador persistido em `sales.payment_method`. */
  id: string;
  /** "cash" = liquidação imediata; "deferred" = compensação futura. */
  kind: PaymentMethodKind;
}

/**
 * PIX (Bella Pay e Próprio), Dinheiro e Débito são liquidação imediata
 * (à vista). Crédito, Boleto e Link envolvem compensação futura.
 */
export const PAYMENT_METHOD_REGISTRY: Readonly<Record<string, PaymentMethodDescriptor>> = {
  pix: { id: "pix", kind: "cash" },
  pix_manual: { id: "pix_manual", kind: "cash" },
  cash: { id: "cash", kind: "cash" },
  debit_card: { id: "debit_card", kind: "cash" },
  credit_card: { id: "credit_card", kind: "deferred" },
  payment_link: { id: "payment_link", kind: "deferred" },
  boleto: { id: "boleto", kind: "deferred" },
  // Venda registrada aguardando pagamento — compensação futura.
  a_receber: { id: "a_receber", kind: "deferred" },
} as const;

/**
 * Retorna `true` quando o `id` está registrado como forma de pagamento
 * à vista. Ids desconhecidos retornam `false` (mantém regra atual da
 * política — cai no fluxo baseado em `allowedMethods`).
 */
export function isCashPaymentMethod(id: string | null | undefined): boolean {
  if (!id) return false;
  const entry = PAYMENT_METHOD_REGISTRY[id.trim()];
  return entry?.kind === "cash";
}
