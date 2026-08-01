/**
 * Sessão temporária de carrinho por conversa (Bella / WhatsApp).
 *
 * Camada PURA e EFÊMERA:
 * - não cria venda, não reserva estoque, não toca financeiro/CRM/catálogo;
 * - não grava nada no banco — a sessão vive só durante a conversa e expira.
 */
import type { ProductSearchItem } from "./product-search";

export interface CartSessionItem {
  productId: string;
  name: string;
  qty: number;
  /** Preço do momento em que o item entrou no carrinho. */
  unitPrice: number;
  subtotal: number;
}

export interface CartSession {
  companyId: string;
  phone: string;
  items: CartSessionItem[];
  total: number;
  createdAt: number;
  updatedAt: number;
}

/** Tempo de vida da sessão conversacional (30 min sem interação). */
export const CART_SESSION_TTL_MS = 30 * 60 * 1000;

export function createCartSession(
  companyId: string,
  phone: string,
  now: number = Date.now(),
): CartSession {
  return { companyId, phone, items: [], total: 0, createdAt: now, updatedAt: now };
}

export function isCartSessionExpired(
  session: CartSession | null | undefined,
  now: number = Date.now(),
  ttlMs: number = CART_SESSION_TTL_MS,
): boolean {
  if (!session) return true;
  return now - session.updatedAt > ttlMs;
}

function recalc(session: CartSession, items: CartSessionItem[], now: number): CartSession {
  const priced = items.map((i) => ({ ...i, subtotal: round(i.unitPrice * i.qty) }));
  return {
    ...session,
    items: priced,
    total: round(priced.reduce((sum, i) => sum + i.subtotal, 0)),
    updatedAt: now,
  };
}

function round(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function addProduct(
  session: CartSession,
  product: ProductSearchItem,
  qty = 1,
  now: number = Date.now(),
): CartSession {
  const items = [...session.items];
  const idx = items.findIndex((i) => i.productId === product.id);
  if (idx >= 0) {
    items[idx] = { ...items[idx]!, qty: items[idx]!.qty + qty };
  } else {
    items.push({
      productId: product.id,
      name: product.name,
      qty,
      unitPrice: product.price,
      subtotal: product.price * qty,
    });
  }
  return recalc(session, items, now);
}

export function removeAt(
  session: CartSession,
  index: number,
  now: number = Date.now(),
): { session: CartSession; removed: CartSessionItem | null } {
  if (index < 0 || index >= session.items.length) return { session, removed: null };
  const items = [...session.items];
  const [removed] = items.splice(index, 1);
  return { session: recalc(session, items, now), removed: removed ?? null };
}

export function removeProductById(
  session: CartSession,
  productId: string,
  now: number = Date.now(),
): { session: CartSession; removed: CartSessionItem | null } {
  return removeAt(
    session,
    session.items.findIndex((i) => i.productId === productId),
    now,
  );
}

export function clearCartSession(
  session: CartSession,
  now: number = Date.now(),
): CartSession {
  return recalc(session, [], now);
}

export function cartItemCount(session: CartSession): number {
  return session.items.reduce((sum, i) => sum + i.qty, 0);
}
