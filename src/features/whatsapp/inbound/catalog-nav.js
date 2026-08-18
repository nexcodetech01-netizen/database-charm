/**
 * Navegação de catálogo por categorias (WhatsApp / Bella inbound).
 *
 * Camada PURA: só decide intenção, casa categoria e formata mensagens.
 * Não altera cadastro de produtos, preços, estoque ou regras do catálogo —
 * apenas apresenta as categorias existentes antes de listar produtos.
 */
const ICON_EMOJI = {
    Tag: "🏷️",
    Package: "📦",
    Boxes: "📦",
    ShoppingBag: "👜",
    Shirt: "👕",
    Coffee: "☕",
    Utensils: "🍽️",
    Wrench: "🔧",
    Cpu: "💻",
    Book: "📚",
    Gift: "🎁",
    Home: "🏠",
    Car: "🚗",
    Heart: "💖",
    Star: "⭐",
    Layers: "🗂️",
};
export function categoryEmoji(icon) {
    return (icon && ICON_EMOJI[icon]) || "•";
}
export function normalize(text) {
    return String(text ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}
const CATALOG_RE = /\b(catalogo|catalogos|vitrine|produtos?|quero ver|o que voces? (tem|vendem)|mostrar? (os )?produtos)\b/;
const BACK_RE = /\b(voltar|voltar as categorias|categorias|menu|inicio)\b/;
export function isCatalogIntent(text) {
    return CATALOG_RE.test(normalize(text));
}
export function isBackIntent(text) {
    return BACK_RE.test(normalize(text));
}
/** Casa a mensagem com uma categoria: por número exibido ou por nome. */
export function matchCategory(text, categories) {
    const t = normalize(text);
    if (!t)
        return null;
    const asIndex = t.match(/^(\d{1,2})[).\s]*$/);
    if (asIndex) {
        const idx = Number(asIndex[1]) - 1;
        return categories[idx] ?? null;
    }
    const exact = categories.find((c) => normalize(c.name) === t);
    if (exact)
        return exact;
    const partial = categories.filter((c) => t.includes(normalize(c.name)) || normalize(c.name).includes(t));
    return partial.length === 1 ? partial[0] : null;
}
export function formatCategoriesMessage(categories) {
    if (categories.length === 0) {
        return "Ainda não temos produtos disponíveis no catálogo no momento. Me avise se eu puder ajudar com outra coisa! 😊";
    }
    const lines = categories.map((c, i) => `${i + 1}. ${categoryEmoji(c.icon)} ${c.name}`);
    return [
        "Claro! Confira as nossas categorias de produtos disponíveis:",
        "",
        ...lines,
        "",
        "Qual dessas você gostaria de ver? É só responder com o nome ou o número! 😊",
    ].join("\n");
}
function money(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(Number.isFinite(value) ? value : 0);
}
export const CATALOG_PRODUCTS_LIMIT = 30;
export function formatProductsMessage(categoryName, products) {
    if (products.length === 0) {
        return [
            `Poxa, não temos produtos disponíveis em *${categoryName}* no momento.`,
            "",
            "Gostaria de ver outra categoria? Me avise o que você procura! 😊",
        ].join("\n");
    }
    const lines = products
        .slice(0, CATALOG_PRODUCTS_LIMIT)
        .map((p) => `• *${p.name}* — *${money(p.price)}*`);
    const extra = products.length > CATALOG_PRODUCTS_LIMIT
        ? [`_… e mais ${products.length - CATALOG_PRODUCTS_LIMIT} produto(s)._`]
        : [];
    return [
        `Temos sim! Confira as nossas opções em *${categoryName}*:`,
        "",
        ...lines,
        ...extra,
        "",
        "Gostou de algum desses modelos? Me avise se quiser ver fotos ou tirar alguma dúvida! 😊",
    ].join("\n");
}
