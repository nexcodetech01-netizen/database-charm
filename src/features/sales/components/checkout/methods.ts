import {
  Banknote,
  Barcode,
  CreditCard,
  HandCoins,
  Link as LinkIcon,
  QrCode,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { UiCheckoutMethod } from "./types";

export interface CheckoutMethodOption {
  id: UiCheckoutMethod;
  label: string;
  icon: LucideIcon;
  hint: string;
}

/** Métodos que dependem do Asaas (Bella Pay) conectado. */
const ASAAS_ONLY: ReadonlySet<UiCheckoutMethod> = new Set(["payment_link", "boleto"]);

/**
 * Formas de pagamento do checkout.
 *
 * Sem Asaas conectado, "Crédito" é o crédito na maquininha (baixa manual,
 * com parcelas) e Link/Boleto ficam ocultos — eles só existem pelo Asaas.
 */
export function checkoutMethodsFor(options: { asaasConnected: boolean }): CheckoutMethodOption[] {
  const { asaasConnected } = options;
  const all: CheckoutMethodOption[] = [
    { id: "pix_manual", label: "Pix", icon: Wallet, hint: "QR Code da sua chave" },
    { id: "pix", label: "Pix maquininha", icon: QrCode, hint: "Pago na maquininha" },
    {
      id: "credit_card",
      label: "Crédito",
      icon: CreditCard,
      hint: asaasConnected ? "Parcelado (Asaas)" : "Maquininha, com parcelas",
    },
    { id: "debit_card", label: "Débito", icon: CreditCard, hint: "Maquininha" },
    { id: "payment_link", label: "Link", icon: LinkIcon, hint: "PIX + cartão + boleto" },
    { id: "boleto", label: "Boleto", icon: Barcode, hint: "Boleto bancário (Asaas)" },
    { id: "cash", label: "Dinheiro", icon: Banknote, hint: "Baixa imediata + troco" },
    { id: "credit", label: "Crediário", icon: HandCoins, hint: "Venda a prazo na conta do cliente" },
    {
      id: "pending_payment",
      label: "Pagamento Pendente",
      icon: Wallet,
      hint: "Venda finalizada. O pagamento será informado posteriormente.",
    },
  ];
  return asaasConnected ? all : all.filter((m) => !ASAAS_ONLY.has(m.id));
}

/** Lista completa (compatibilidade). */
export const CHECKOUT_METHODS: readonly CheckoutMethodOption[] = checkoutMethodsFor({
  asaasConnected: true,
});
