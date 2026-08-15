/**
 * Upsell / produtos complementares (Sprint 6.7 — Etapa 6).
 *
 * Camada PURA e determinística: decide QUANDO sugerir, ranqueia os
 * complementares e formata a mensagem. Sem IA externa.
 *
 * NÃO cria venda, não movimenta estoque, não altera banco, cadastro,
 * catálogo, carrinho, financeiro ou CRM. Reutiliza o contexto
 * conversacional e o carrinho efêmero já existentes (Etapas 2/3).
 */
import { normalize } from "./catalog-nav";
import { hasAddIntent } from "./cart";
import { isCartSessionExpired } from "./cart-session";
/** Máximo de sugestões complementares por turno. */
export const MAX_UPSELL_SUGGESTIONS = 3;
const INTEREST_RE = /\b(gostei|amei|adorei|perfeit[oa]|essa mesmo|esse mesmo|vou levar|vou querer|quero ess[ae]|pode adicionar|fechado|topo)\b/;
/**
 * Confirmação de interesse / adição ao pedido.
 * Reutiliza o parser do carrinho — nenhuma intenção nova é criada.
 */
export function isUpsellTriggerIntent(text) {
    const t = normalize(text);
    if (!t)
        return false;
    return hasAddIntent(t) || INTEREST_RE.test(t);
}
function isActive(p) {
    return p.status == null || String(p.status) === "active";
}
/**
 * Prioridade determinística:
 * 1. relacionamento explícito
 * 2. mesma coleção
 * 3. categoria complementar configurada
 * 4. mesma marca
 * 5. faixa de preço semelhante
 */
export function rankUpsell(options) {
    const { current, candidates } = options;
    const limit = options.limit ?? MAX_UPSELL_SUGGESTIONS;
    const excluded = new Set([current.id, ...(options.cartProductIds ?? [])]);
    const related = new Set(current.relatedProductIds ?? []);
    const collections = new Set(current.collectionIds ?? []);
    const complementary = new Set(options.complementaryCategoryIds ?? []);
    const base = Number(current.price) || 0;
    const scored = candidates
        .filter((p) => p && isActive(p) && !excluded.has(p.id))
        .map((p) => {
        const price = Number(p.price) || 0;
        let score = 0;
        if (related.has(p.id) || (p.relatedProductIds ?? []).includes(current.id)) {
            score += 1000;
        }
        if ((p.collectionIds ?? []).some((c) => collections.has(c)))
            score += 500;
        if (p.categoryId && complementary.has(p.categoryId))
            score += 250;
        if (current.brand &&
            p.brand &&
            normalize(p.brand) === normalize(current.brand)) {
            score += 100;
        }
        const delta = base > 0 ? Math.abs(price - base) / base : 1;
        score += Math.max(0, 25 - Math.min(25, delta * 25));
        return { product: p, score, delta };
    });
    scored.sort((a, b) => b.score - a.score ||
        a.delta - b.delta ||
        a.product.name.localeCompare(b.product.name, "pt-BR"));
    return scored.slice(0, Math.max(0, limit)).map((s) => s.product);
}
function money(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(Number.isFinite(value) ? value : 0);
}
export const UPSELL_FOOTER = "Gostaria de adicionar algum deles ao seu pedido? 😊";
/** Mensagem de sugestões complementares. Vazia quando não há o que sugerir. */
export function formatUpsellMessage(products) {
    if (products.length === 0)
        return "";
    const lines = [
        "💕 Excelente escolha!",
        "",
        "Quem compra esse produto também costuma gostar destes:",
        "",
    ];
    for (const p of products) {
        lines.push(`📸 ${p.name}`, money(Number(p.price) || 0), "");
    }
    lines.push(UPSELL_FOOTER);
    return lines.join("\n");
}
/** Produto de referência do turno: o recém-escolhido ou o último do carrinho. */
export function resolveUpsellProductId(args) {
    const now = args.now ?? Date.now();
    const last = args.lastProductIds ?? [];
    if (last.length === 1)
        return last[0];
    const session = args.session;
    if (session && !isCartSessionExpired(session, now) && session.items.length > 0) {
        return session.items[session.items.length - 1].productId;
    }
    return null;
}
