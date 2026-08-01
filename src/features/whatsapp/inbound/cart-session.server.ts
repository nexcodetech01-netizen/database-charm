/**
 * Store EFÊMERO das sessões de carrinho por conversa.
 *
 * Server-only, em memória. Nada é gravado no banco: se o processo reiniciar
 * ou a sessão expirar, o carrinho simplesmente deixa de existir.
 * Não cria venda, não reserva estoque, não movimenta financeiro/CRM.
 */
import {
  CART_SESSION_TTL_MS,
  createCartSession,
  isCartSessionExpired,
  type CartSession,
} from "./cart-session";

const sessions = new Map<string, CartSession>();

function key(companyId: string, phone: string): string {
  return `${companyId}:${phone}`;
}

function sweep(now: number): void {
  for (const [k, session] of sessions) {
    if (isCartSessionExpired(session, now, CART_SESSION_TTL_MS)) sessions.delete(k);
  }
}

/** Sessão viva da conversa, ou uma nova quando não existe / expirou. */
export function getCartSession(
  companyId: string,
  phone: string,
  now: number = Date.now(),
): CartSession {
  sweep(now);
  const existing = sessions.get(key(companyId, phone));
  if (existing && !isCartSessionExpired(existing, now)) return existing;
  const fresh = createCartSession(companyId, phone, now);
  sessions.set(key(companyId, phone), fresh);
  return fresh;
}

export function saveCartSession(session: CartSession): CartSession {
  sessions.set(key(session.companyId, session.phone), session);
  return session;
}

export function dropCartSession(companyId: string, phone: string): void {
  sessions.delete(key(companyId, phone));
}

/** Apenas para testes: zera o store. */
export function resetCartSessions(): void {
  sessions.clear();
}
