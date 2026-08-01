/**
 * Fechamento conversacional da Bella (Sprint 6.8 — Etapa 1).
 *
 * Camada PURA e EFÊMERA: máquina de estados do "fechar pedido".
 * NÃO cria venda, NÃO cria orçamento, NÃO reserva/movimenta estoque,
 * NÃO altera financeiro, CRM, cadastro, catálogo nem qualquer motor
 * oficial do ERP. Nada é gravado no banco — tudo vive na conversa.
 */
import { normalize } from "./catalog-nav";
import type { CartSession } from "./cart-session";

export type CheckoutStep =
  | "buyer_name"
  | "fulfillment"
  | "delivery_city"
  | "delivery_neighborhood"
  | "delivery_address"
  | "delivery_complement"
  | "payment"
  | "summary"
  | "done";

export type FulfillmentKind = "pickup" | "delivery";
export type PaymentKind = "pix" | "card" | "cash";

export interface CheckoutDelivery {
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  complement: string | null;
}

export interface CheckoutSession {
  companyId: string;
  phone: string;
  step: CheckoutStep;
  buyerName: string | null;
  fulfillment: FulfillmentKind | null;
  delivery: CheckoutDelivery;
  payment: PaymentKind | null;
  createdAt: number;
  updatedAt: number;
}

/** Tempo de vida do fechamento conversacional (30 min sem interação). */
export const CHECKOUT_SESSION_TTL_MS = 30 * 60 * 1000;

export const EMPTY_CART_MESSAGE =
  "Seu carrinho ainda está vazio 😊 Me diga o que você procura que eu te mostro as opções.";
export const CHECKOUT_ABORTED_MESSAGE =
  "Sem problemas! Cancelei o fechamento, mas seu carrinho continua salvo. 😊";
export const SUMMARY_CONFIRM_MESSAGE = "Está tudo correto? 😊";

const FINALIZE_RE =
  /\b(quero finalizar|finalizar|fechar pedido|fechar o pedido|fechar a compra|concluir compra|concluir o pedido|concluir|pode finalizar|pode fechar|vamos fechar|quero comprar|fechar|continuar)\b/;
const ABORT_RE =
  /\b(cancelar|cancela|desistir|deixa pra la|para|parar|voltar ao catalogo|nao quero mais)\b/;
const RESTART_RE = /\b(recomecar|comecar de novo|reiniciar|refazer|do inicio)\b/;

const PICKUP_RE = /\b(retirar|retirada|retiro|buscar|loja|pegar na loja)\b/;
const DELIVERY_RE = /\b(entrega|entregar|delivery|receber em casa|envio|enviar)\b/;

const PIX_RE = /\bpix\b/;
const CARD_RE = /\b(cartao|credito|debito|card|maquininha)\b/;
const CASH_RE = /\b(dinheiro|especie|cash|a vista)\b/;

const SKIP_RE = /\b(nao|nao tem|sem complemento|pular|nenhum|n\/a|-)\b/;

export function createCheckoutSession(
  companyId: string,
  phone: string,
  now: number = Date.now(),
): CheckoutSession {
  return {
    companyId,
    phone,
    step: "buyer_name",
    buyerName: null,
    fulfillment: null,
    delivery: { city: null, neighborhood: null, address: null, complement: null },
    payment: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function isCheckoutSessionExpired(
  session: CheckoutSession | null | undefined,
  now: number = Date.now(),
  ttlMs: number = CHECKOUT_SESSION_TTL_MS,
): boolean {
  if (!session) return true;
  return now - session.updatedAt > ttlMs;
}

/** "quero finalizar", "fechar pedido", "continuar"… */
export function isCheckoutIntent(text: string): boolean {
  const t = normalize(text ?? "");
  if (!t) return false;
  return FINALIZE_RE.test(t);
}

export function isAbortIntent(text: string): boolean {
  const t = normalize(text ?? "");
  return Boolean(t) && ABORT_RE.test(t);
}

export function isRestartIntent(text: string): boolean {
  const t = normalize(text ?? "");
  return Boolean(t) && RESTART_RE.test(t);
}

export function parseFulfillment(text: string): FulfillmentKind | null {
  const t = normalize(text ?? "");
  if (!t) return null;
  if (t === "1") return "pickup";
  if (t === "2") return "delivery";
  if (PICKUP_RE.test(t)) return "pickup";
  if (DELIVERY_RE.test(t)) return "delivery";
  return null;
}

export function parsePayment(text: string): PaymentKind | null {
  const t = normalize(text ?? "");
  if (!t) return null;
  if (t === "1") return "pix";
  if (t === "2") return "card";
  if (t === "3") return "cash";
  if (PIX_RE.test(t)) return "pix";
  if (CARD_RE.test(t)) return "card";
  if (CASH_RE.test(t)) return "cash";
  return null;
}

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

export const PROMPTS: Record<Exclude<CheckoutStep, "summary" | "done">, string> = {
  buyer_name: "Qual será o nome do comprador?",
  fulfillment: ["Como deseja receber?", "", "🏪 Retirar na loja", "🚚 Entrega"].join("\n"),
  delivery_city: "Qual a cidade da entrega?",
  delivery_neighborhood: "Qual o bairro?",
  delivery_address: "Qual o endereço (rua e número)?",
  delivery_complement: "Algum complemento? (opcional — responda *não* para pular)",
  payment: ["Como pretende pagar?", "", "• PIX", "• Cartão", "• Dinheiro"].join("\n"),
};

const PAYMENT_LABEL: Record<PaymentKind, string> = {
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
};

export function formatFulfillmentLine(session: CheckoutSession): string {
  if (session.fulfillment === "pickup") return "🏪 Retirada na loja";
  const d = session.delivery;
  const parts = [d.address, d.neighborhood, d.city, d.complement].filter(
    (v): v is string => Boolean(v && v.trim()),
  );
  return `🚚 Entrega — ${parts.join(", ")}`;
}

export function formatCheckoutSummary(
  session: CheckoutSession,
  cart: CartSession,
): string {
  const items = cart.items.map(
    (i) => `• ${i.qty}x ${i.name} — ${money(i.subtotal)}`,
  );
  return [
    "🛍️ *Resumo do Pedido*",
    "",
    `Comprador: ${session.buyerName ?? "-"}`,
    "",
    "Itens:",
    ...items,
    "",
    "Entrega:",
    formatFulfillmentLine(session),
    "",
    "Pagamento:",
    session.payment ? PAYMENT_LABEL[session.payment] : "-",
    "",
    `Total: ${money(cart.total)}`,
    "",
    SUMMARY_CONFIRM_MESSAGE,
  ].join("\n");
}

export interface CheckoutAdvanceResult {
  session: CheckoutSession;
  /** Resposta da Bella para este turno. */
  text: string;
  /** true quando o fluxo foi abandonado pelo cliente. */
  aborted: boolean;
}

function next(
  session: CheckoutSession,
  patch: Partial<CheckoutSession>,
  now: number,
): CheckoutSession {
  return { ...session, ...patch, updatedAt: now };
}

/**
 * Avança um passo do fechamento com a mensagem do cliente.
 * Puro: recebe e devolve estado, nunca toca em banco ou motores.
 */
export function advanceCheckout(args: {
  session: CheckoutSession;
  cart: CartSession;
  text: string;
  now?: number;
}): CheckoutAdvanceResult {
  const now = args.now ?? Date.now();
  const text = (args.text ?? "").trim();
  const session = args.session;

  if (isAbortIntent(text)) {
    return {
      session: next(session, { step: "done" }, now),
      text: CHECKOUT_ABORTED_MESSAGE,
      aborted: true,
    };
  }

  if (isRestartIntent(text)) {
    const fresh = createCheckoutSession(session.companyId, session.phone, now);
    return { session: fresh, text: PROMPTS.buyer_name, aborted: false };
  }

  if (args.cart.items.length === 0) {
    return {
      session: next(session, { step: "done" }, now),
      text: EMPTY_CART_MESSAGE,
      aborted: false,
    };
  }

  switch (session.step) {
    case "buyer_name": {
      if (!text) return { session, text: PROMPTS.buyer_name, aborted: false };
      return {
        session: next(session, { buyerName: text, step: "fulfillment" }, now),
        text: PROMPTS.fulfillment,
        aborted: false,
      };
    }
    case "fulfillment": {
      const kind = parseFulfillment(text);
      if (!kind) return { session, text: PROMPTS.fulfillment, aborted: false };
      if (kind === "pickup") {
        return {
          session: next(session, { fulfillment: "pickup", step: "payment" }, now),
          text: PROMPTS.payment,
          aborted: false,
        };
      }
      return {
        session: next(session, { fulfillment: "delivery", step: "delivery_city" }, now),
        text: PROMPTS.delivery_city,
        aborted: false,
      };
    }
    case "delivery_city": {
      if (!text) return { session, text: PROMPTS.delivery_city, aborted: false };
      return {
        session: next(
          session,
          { delivery: { ...session.delivery, city: text }, step: "delivery_neighborhood" },
          now,
        ),
        text: PROMPTS.delivery_neighborhood,
        aborted: false,
      };
    }
    case "delivery_neighborhood": {
      if (!text) return { session, text: PROMPTS.delivery_neighborhood, aborted: false };
      return {
        session: next(
          session,
          { delivery: { ...session.delivery, neighborhood: text }, step: "delivery_address" },
          now,
        ),
        text: PROMPTS.delivery_address,
        aborted: false,
      };
    }
    case "delivery_address": {
      if (!text) return { session, text: PROMPTS.delivery_address, aborted: false };
      return {
        session: next(
          session,
          { delivery: { ...session.delivery, address: text }, step: "delivery_complement" },
          now,
        ),
        text: PROMPTS.delivery_complement,
        aborted: false,
      };
    }
    case "delivery_complement": {
      const skip = !text || SKIP_RE.test(normalize(text));
      return {
        session: next(
          session,
          {
            delivery: { ...session.delivery, complement: skip ? null : text },
            step: "payment",
          },
          now,
        ),
        text: PROMPTS.payment,
        aborted: false,
      };
    }
    case "payment": {
      const payment = parsePayment(text);
      if (!payment) return { session, text: PROMPTS.payment, aborted: false };
      const withPayment = next(session, { payment, step: "summary" }, now);
      return {
        session: withPayment,
        text: formatCheckoutSummary(withPayment, args.cart),
        aborted: false,
      };
    }
    case "summary":
    case "done":
    default:
      return {
        session: next(session, {}, now),
        text: formatCheckoutSummary(session, args.cart),
        aborted: false,
      };
  }
}
