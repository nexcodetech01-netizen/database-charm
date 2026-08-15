/** Tempo de vida da sessão conversacional (30 min sem interação). */
export const CART_SESSION_TTL_MS = 30 * 60 * 1000;
export function createCartSession(companyId, phone, now = Date.now()) {
    return { companyId, phone, items: [], total: 0, createdAt: now, updatedAt: now };
}
export function isCartSessionExpired(session, now = Date.now(), ttlMs = CART_SESSION_TTL_MS) {
    if (!session)
        return true;
    return now - session.updatedAt > ttlMs;
}
function recalc(session, items, now) {
    const priced = items.map((i) => ({ ...i, subtotal: round(i.unitPrice * i.qty) }));
    return {
        ...session,
        items: priced,
        total: round(priced.reduce((sum, i) => sum + i.subtotal, 0)),
        updatedAt: now,
    };
}
function round(value) {
    return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}
export function addProduct(session, product, qty = 1, now = Date.now()) {
    const items = [...session.items];
    const idx = items.findIndex((i) => i.productId === product.id);
    if (idx >= 0) {
        items[idx] = { ...items[idx], qty: items[idx].qty + qty };
    }
    else {
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
export function removeAt(session, index, now = Date.now()) {
    if (index < 0 || index >= session.items.length)
        return { session, removed: null };
    const items = [...session.items];
    const [removed] = items.splice(index, 1);
    return { session: recalc(session, items, now), removed: removed ?? null };
}
export function removeProductById(session, productId, now = Date.now()) {
    return removeAt(session, session.items.findIndex((i) => i.productId === productId), now);
}
export function clearCartSession(session, now = Date.now()) {
    return recalc(session, [], now);
}
export function cartItemCount(session) {
    return session.items.reduce((sum, i) => sum + i.qty, 0);
}
