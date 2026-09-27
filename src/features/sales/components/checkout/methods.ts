import {
  Banknote,
  Barcode,
  CreditCard,
  HandCoins,
  Link as LinkIcon,
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

export const CHECKOUT_METHODS: readonly CheckoutMethodOption[] = [
  { id: "pix_manual", label: "Pix", icon: Wallet, hint: "Recebido direto na sua conta" },
  { id: "credit_card", label: "Crédito", icon: CreditCard, hint: "Parcelado (Asaas)" },
  { id: "payment_link", label: "Link", icon: LinkIcon, hint: "PIX + cartão + boleto" },
  { id: "boleto", label: "Boleto", icon: Barcode, hint: "Boleto bancário (Asaas)" },
  { id: "cash", label: "Dinheiro", icon: Banknote, hint: "Baixa imediata + troco" },
  { id: "debit_card", label: "Débito", icon: CreditCard, hint: "Baixa manual" },
  { id: "credit", label: "Crediário", icon: HandCoins, hint: "Venda a prazo na conta do cliente" },
  {
    id: "pending_payment",
    label: "Pagamento Pendente",
    icon: Wallet,
    hint: "Venda finalizada. O pagamento será informado posteriormente.",
  },
];
