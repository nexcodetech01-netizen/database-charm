/**
 * Inbox Comercial (Sprint 6.8 — Etapa 2) — camada PURA.
 *
 * Monta o "atendimento comercial" a partir do carrinho + fechamento
 * conversacional. NÃO cria venda, NÃO cria orçamento, NÃO movimenta
 * estoque, NÃO gera financeiro, NÃO altera CRM e NÃO chama
 * `create_sale()` nem qualquer motor oficial do ERP.
 */
import { normalize } from "./catalog-nav";
import type { CartSession } from "./cart-session";
import type { CheckoutSession } from "./checkout-session";

export const COMMERCIAL_INBOX_STATUS = {
  waiting: "aguardando_atendimento",
  attended: "atendido",
  cancelled: "cancelado",
  converted: "convertido",
} as const;

export type CommercialInboxStatus =
  (typeof COMMERCIAL_INBOX_STATUS)[keyof typeof COMMERCIAL_INBOX_STATUS];

export const COMMERCIAL_INBOX_ORIGIN = "whatsapp";

export const COMMERCIAL_HANDOFF_MESSAGE = [
  "Perfeito! 💕",
  "",
  "Seu pedido foi encaminhado para nossa equipe.",
  "",
  "Em breve um atendente continuará seu atendimento.",
].join("\n");

const CONFIRM_RE =
  /^(sim|isso|ok|okay|confirmo|confirmado|confirmar|certo|esta certo|ta certo|tudo certo|perfeito|pode finalizar|pode sim|pode confirmar|fechado)\b/;

/** "sim", "confirmo", "está certo", "pode finalizar", "ok", "confirmado". */
export function isConfirmationIntent(text: string): boolean {
  const t = normalize(text ?? "").trim();
  if (!t) return false;
  return CONFIRM_RE.test(t);
}

export interface CommercialTicketItem {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface CommercialCustomerData {
  fullName: string | null;
  personType: "pf" | "pj" | null;
  cpf: string | null;
  cnpj: string | null;
  birthDate: null;
  zipCode: string | null;
  state: string | null;
  city: string | null;
  district: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
}

export interface CommercialTicketDraft {
  companyId: string;
  phone: string;
  buyerName: string | null;
  /** Dados básicos do cliente — vivem SOMENTE no atendimento do Inbox. */
  customer: CommercialCustomerData;
  items: CommercialTicketItem[];
  itemCount: number;
  total: number;
  fulfillment: "pickup" | "delivery";
  delivery: {
    city: string | null;
    neighborhood: string | null;
    address: string | null;
    complement: string | null;
  };
  payment: string | null;
  changeNeeded: boolean | null;
  changeAmount: number | null;
  origin: typeof COMMERCIAL_INBOX_ORIGIN;
  status: CommercialInboxStatus;
  createdAt: string;
}

/** Snapshot do pedido conversacional — apenas dados, nenhum efeito. */
export function buildCommercialTicketDraft(args: {
  session: CheckoutSession;
  cart: CartSession;
  now?: number;
}): CommercialTicketDraft {
  const { session, cart } = args;
  const items: CommercialTicketItem[] = cart.items.map((i) => ({
    productId: i.productId,
    name: i.name,
    qty: i.qty,
    unitPrice: i.unitPrice,
    subtotal: i.subtotal,
  }));
  const c = session.customer;
  return {
    companyId: session.companyId,
    phone: session.phone,
    buyerName: c.fullName ?? session.buyerName,
    customer: {
      fullName: c.fullName ?? session.buyerName,
      personType: c.personType,
      cpf: c.cpf,
      cnpj: c.cnpj,
      birthDate: null,
      zipCode: c.zipCode,
      state: c.state,
      city: c.city,
      district: c.district,
      street: c.street,
      number: c.number,
      complement: c.complement,
    },
    items,
    itemCount: items.reduce((sum, i) => sum + i.qty, 0),
    total: cart.total,
    fulfillment: session.fulfillment ?? "pickup",
    delivery: { ...session.delivery },
    payment: session.payment,
    changeNeeded: session.changeNeeded,
    changeAmount: session.changeAmount,
    origin: COMMERCIAL_INBOX_ORIGIN,
    status: COMMERCIAL_INBOX_STATUS.waiting,
    createdAt: new Date(args.now ?? Date.now()).toISOString(),
  };
}

export const COMMERCIAL_STATUS_LABEL: Record<CommercialInboxStatus, string> = {
  aguardando_atendimento: "Aguardando atendimento",
  atendido: "Atendido",
  cancelado: "Cancelado",
  convertido: "Convertido em venda",
};

export const FULFILLMENT_LABEL: Record<"pickup" | "delivery", string> = {
  pickup: "Retirada na loja",
  delivery: "Entrega",
};

export const PAYMENT_LABEL: Record<string, string> = {
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
};

/** Linha do endereço para exibição (vazia na retirada). */
export function formatDeliveryLine(draft: {
  fulfillment: "pickup" | "delivery";
  delivery: CommercialTicketDraft["delivery"];
}): string {
  if (draft.fulfillment === "pickup") return "";
  return [
    draft.delivery.address,
    draft.delivery.neighborhood,
    draft.delivery.city,
    draft.delivery.complement,
  ]
    .filter((v): v is string => Boolean(v && v.trim()))
    .join(", ");
}
