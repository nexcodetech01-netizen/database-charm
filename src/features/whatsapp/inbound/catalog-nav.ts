/**
 * Navegação de catálogo por categorias (WhatsApp / Bella inbound).
 *
 * Camada PURA: só decide intenção, casa categoria e formata mensagens.
 * Não altera cadastro de produtos, preços, estoque ou regras do catálogo —
 * apenas apresenta as categorias existentes antes de listar produtos.
 */

export interface CatalogCategoryOption {
  id: string;
  name: string;
  icon: string | null;
  productCount: number;
}

export interface CatalogProductOption {
  id: string;
  name: string;
  price: number;
  unit: string | null;
}

/** Estado curto guardado em `whatsapp_conversations.bella_state.catalog`. */
export interface CatalogNavState {
  step: "categories" | "products" | "cart";
  /** Ordem exibida na última listagem de categorias (para escolha por número). */
  categoryIds?: string[];
  categoryId?: string;
  /** Últimos produtos mostrados (para entender "quero essa"). */
  lastProductIds?: string[];
}

const ICON_EMOJI: Record<string, string> = {
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

export function categoryEmoji(icon: string | null | undefined): string {
  return (icon && ICON_EMOJI[icon]) || "•";
}

export function normalize(text: string): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const CATALOG_RE =
  /\b(catalogo|catalogos|vitrine|produtos?|quero ver|o que voces? (tem|vendem)|mostrar? (os )?produtos)\b/;
const BACK_RE = /\b(voltar|voltar as categorias|categorias|menu|inicio)\b/;

export function isCatalogIntent(text: string): boolean {
  return CATALOG_RE.test(normalize(text));
}

export function isBackIntent(text: string): boolean {
  return BACK_RE.test(normalize(text));
}

/** Casa a mensagem com uma categoria: por número exibido ou por nome. */
export function matchCategory(
  text: string,
  categories: CatalogCategoryOption[],
): CatalogCategoryOption | null {
  const t = normalize(text);
  if (!t) return null;

  const asIndex = t.match(/^(\d{1,2})[).\s]*$/);
  if (asIndex) {
    const idx = Number(asIndex[1]) - 1;
    return categories[idx] ?? null;
  }

  const exact = categories.find((c) => normalize(c.name) === t);
  if (exact) return exact;

  const partial = categories.filter(
    (c) => t.includes(normalize(c.name)) || normalize(c.name).includes(t),
  );
  return partial.length === 1 ? partial[0]! : null;
}

export function formatCategoriesMessage(categories: CatalogCategoryOption[]): string {
  if (categories.length === 0) {
    return "Ainda não temos produtos disponíveis no catálogo no momento.";
  }
  const lines = categories.map(
    (c, i) => `${i + 1}. ${categoryEmoji(c.icon)} ${c.name}`,
  );
  return [
    "*Temos estas categorias:*",
    "",
    ...lines,
    "",
    "_Responda com o nome ou o número da categoria para ver os produtos._",
  ].join("\n");
}

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

export const CATALOG_PRODUCTS_LIMIT = 30;

export function formatProductsMessage(
  categoryName: string,
  products: CatalogProductOption[],
): string {
  if (products.length === 0) {
    return [
      `*${categoryName}*`,
      "",
      "Nenhum produto disponível nesta categoria agora.",
      "",
      "_Digite *voltar* para ver as categorias._",
    ].join("\n");
  }
  const lines = products
    .slice(0, CATALOG_PRODUCTS_LIMIT)
    .map((p) => `• ${p.name} — ${money(p.price)}`);
  const extra =
    products.length > CATALOG_PRODUCTS_LIMIT
      ? [`_… e mais ${products.length - CATALOG_PRODUCTS_LIMIT} produto(s)._`]
      : [];
  return [
    `*${categoryName}*`,
    "",
    ...lines,
    ...extra,
    "",
    "_Digite *voltar* para ver as categorias._",
  ].join("\n");
}
