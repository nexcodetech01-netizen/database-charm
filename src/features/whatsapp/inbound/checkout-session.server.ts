/**
 * Store EFÊMERO das sessões de fechamento por conversa (Sprint 6.8 — Etapa 1).
 *
 * Server-only, em memória. Nada é gravado no banco: se o processo reiniciar
 * ou a sessão expirar, o fechamento simplesmente deixa de existir.
 * NÃO cria venda, NÃO cria orçamento, NÃO reserva estoque, NÃO altera
 * financeiro/CRM/cadastro e NÃO chama nenhum motor oficial do ERP.
 */
import { getCartSession } from "./cart-session.server";
import type { CartSession } from "./cart-session";
import {
  CHECKOUT_SESSION_TTL_MS,
  EMPTY_CART_MESSAGE,
  PROMPTS,
  advanceCheckout,
  createCheckoutSession,
  isCheckoutIntent,
  isCheckoutSessionExpired,
  type CheckoutSession,
} from "./checkout-session";

const sessions = new Map<string, CheckoutSession>();

function key(companyId: string, phone: string): string {
  return `${companyId}:${phone}`;
}

function sweep(now: number): void {
  for (const [k, session] of sessions) {
    if (isCheckoutSessionExpired(session, now, CHECKOUT_SESSION_TTL_MS)) sessions.delete(k);
  }
}

/** Sessão viva de fechamento, ou `null` quando não existe / expirou. */
export function peekCheckoutSession(
  companyId: string,
  phone: string,
  now: number = Date.now(),
): CheckoutSession | null {
  sweep(now);
  const existing = sessions.get(key(companyId, phone));
  return existing && !isCheckoutSessionExpired(existing, now) ? existing : null;
}

export function saveCheckoutSession(session: CheckoutSession): CheckoutSession {
  sessions.set(key(session.companyId, session.phone), session);
  return session;
}

export function dropCheckoutSession(companyId: string, phone: string): void {
  sessions.delete(key(companyId, phone));
}

/** Apenas para testes: zera o store. */
export function resetCheckoutSessions(): void {
  sessions.clear();
}

export interface CheckoutTurnResult {
  text: string;
  session: CheckoutSession | null;
  /** Passo atual após o turno (null quando o fluxo terminou/abortou). */
  step: CheckoutSession["step"] | null;
}

/**
 * Resolve o turno de fechamento. Retorna `null` quando não há fluxo ativo
 * e a mensagem não é um pedido de fechamento — o fluxo normal segue.
 */
export function handleCheckoutTurn(args: {
  companyId: string;
  phone: string;
  text: string;
  cart?: CartSession;
  now?: number;
}): CheckoutTurnResult | null {
  const now = args.now ?? Date.now();
  const cart = args.cart ?? getCartSession(args.companyId, args.phone, now);
  const active = peekCheckoutSession(args.companyId, args.phone, now);

  if (!active) {
    if (!isCheckoutIntent(args.text)) return null;
    if (cart.items.length === 0) {
      return { text: EMPTY_CART_MESSAGE, session: null, step: null };
    }
    const fresh = saveCheckoutSession(
      createCheckoutSession(args.companyId, args.phone, now),
    );
    return { text: PROMPTS.buyer_name, session: fresh, step: fresh.step };
  }

  const result = advanceCheckout({ session: active, cart, text: args.text, now });
  if (result.session.step === "done") {
    dropCheckoutSession(args.companyId, args.phone);
    return { text: result.text, session: null, step: null };
  }
  saveCheckoutSession(result.session);
  return { text: result.text, session: result.session, step: result.session.step };
}
