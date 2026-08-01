/**
 * Busca inteligente de produtos da Bella (Sprint 6.7 — Etapa 1).
 *
 * Camada PURA: apenas interpreta a mensagem do cliente e ordena resultados.
 * Não altera cadastro, catálogo, preços, estoque nem qualquer motor
 * (financeiro, estoque, CRM). Somente produtos ativos são considerados,
 * e a consulta em si vive em `product-search.server.ts`.
 */
import { normalize, type CatalogCategoryOption } from "./catalog-nav";

export interface ProductSearchFilters {
  /** Categoria existente casada com a mensagem (nunca inventada). */
  categoryId: string | null;
  categoryName: string | null;
  /** Marca já cadastrada casada com a mensagem. */
  brand: string | null;
  /** Texto livre restante (cor, modelo, característica). */
  text: string | null;
  priceMin: number | null;
  priceMax: number | null;
  /** Mensagem normalizada usada na análise. */
  raw: string;
}

export interface ProductSearchItem {
  id: string;
  name: string;
  price: number;
  brand: string | null;
  categoryId: string | null;
  unit: string | null;
}

export const PRODUCT_SEARCH_LIMIT = 10;

/** Radical simples para casar singular/plural em pt-BR ("bolsas" → "bolsa"). */
export function stem(word: string): string {
  const w = normalize(word);
  if (w.length > 4 && w.endsWith("oes")) return `${w.slice(0, -3)}ao`;
  if (w.length > 4 && w.endsWith("aes")) return `${w.slice(0, -3)}ao`;
  if (w.length > 4 && w.endsWith("eis")) return `${w.slice(0, -3)}el`;
  // "flores" → "flor", mas "perfumes" → "perfume".
  if (w.length > 4 && w.endsWith("es") && /[rzsn]/.test(w[w.length - 3] ?? "")) {
    return w.slice(0, -2);
  }
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

/** Palavras que nunca ajudam a identificar produto/categoria. */
const STOPWORDS = new Set([
  "a","as","o","os","um","uma","uns","umas","de","do","da","dos","das","em","no","na",
  "nos","nas","por","para","pra","pro","com","sem","e","ou","que","qual","quais",
  "quero","queria","gostaria","procuro","procurando","buscando","busco","tem","teria",
  "voces","voce","me","mostra","mostrar","ver","comprar","preciso","estou","ta","esta",
  "algum","alguma","alguns","algumas","bom","boa","dia","tarde","noite","ola","oi",
  "produto","produtos","catalogo","preco","precos","valor","reais","real","r",
  "ate","menos","mais","abaixo","acima","maximo","minimo","partir","entre","custa",
  "custando","faixa","opcao","opcoes","modelo","modelos",
]);

function toNumber(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

const MAX_RE =
  /\b(?:ate|no maximo|maximo (?:de )?|menos de|abaixo de|menor que|nao passe de|nao passar de)\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/;
const MIN_RE =
  /\b(?:acima de|mais de|maior que|a partir de|no minimo|minimo (?:de )?|apartir de)\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/;

/** Extrai preço mínimo e máximo citados na mensagem. */
export function parsePriceRange(text: string): { min: number | null; max: number | null } {
  const t = normalize(text);
  const max = t.match(MAX_RE);
  const min = t.match(MIN_RE);
  return {
    min: min?.[1] ? toNumber(min[1]) : null,
    max: max?.[1] ? toNumber(max[1]) : null,
  };
}

/** Casa a mensagem com uma categoria existente (singular/plural). */
export function matchCategoryByStem(
  text: string,
  categories: readonly CatalogCategoryOption[],
): CatalogCategoryOption | null {
  const tokens = normalize(text).split(/[^a-z0-9]+/).filter(Boolean).map(stem);
  if (tokens.length === 0) return null;

  let best: { category: CatalogCategoryOption; score: number } | null = null;
  for (const category of categories) {
    const words = normalize(category.name).split(/[^a-z0-9]+/).filter(Boolean).map(stem);
    if (words.length === 0) continue;
    const hits = words.filter((w) => tokens.includes(w)).length;
    if (hits === 0) continue;
    const score = hits / words.length;
    if (!best || score > best.score) best = { category, score };
  }
  return best ? best.category : null;
}

/** Casa a mensagem com uma marca já cadastrada. */
export function matchBrand(text: string, brands: readonly string[]): string | null {
  const t = normalize(text);
  let best: string | null = null;
  for (const brand of brands) {
    const b = normalize(brand);
    if (!b) continue;
    const hit = new RegExp(`(^|[^a-z0-9])${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(t);
    if (hit && (!best || b.length > normalize(best).length)) best = brand;
  }
  return best;
}

export interface ParseProductQueryContext {
  categories?: readonly CatalogCategoryOption[];
  brands?: readonly string[];
}

/**
 * Interpreta a mensagem do cliente e devolve os filtros de busca.
 * Nada é consultado aqui — a função é determinística e sem efeitos.
 */
export function parseProductQuery(
  message: string,
  context: ParseProductQueryContext = {},
): ProductSearchFilters {
  const raw = normalize(message);
  const categories = context.categories ?? [];
  const brands = context.brands ?? [];

  const { min, max } = parsePriceRange(raw);
  const category = matchCategoryByStem(raw, categories);
  const brand = matchBrand(raw, brands);

  const categoryStems = category
    ? normalize(category.name).split(/[^a-z0-9]+/).filter(Boolean).map(stem)
    : [];
  const brandStems = brand
    ? normalize(brand).split(/[^a-z0-9]+/).filter(Boolean).map(stem)
    : [];

  const leftovers = raw
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((word) => !/^\d+$/.test(word))
    .filter((word) => !STOPWORDS.has(word))
    .filter((word) => !categoryStems.includes(stem(word)))
    .filter((word) => !brandStems.includes(stem(word)));

  return {
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    brand,
    text: leftovers.length > 0 ? leftovers.join(" ") : null,
    priceMin: min,
    priceMax: max,
    raw,
  };
}

/** Há algo pesquisável na mensagem? */
export function hasSearchableFilters(filters: ProductSearchFilters): boolean {
  return Boolean(
    filters.categoryId ||
      filters.brand ||
      filters.priceMin !== null ||
      filters.priceMax !== null ||
      filters.text,
  );
}

/** Relevância determinística — quanto maior, mais próximo do pedido. */
export function scoreProduct(product: ProductSearchItem, filters: ProductSearchFilters): number {
  let score = 0;
  const name = normalize(product.name);
  const nameStems = name.split(/[^a-z0-9]+/).filter(Boolean).map(stem);

  if (filters.categoryId && product.categoryId === filters.categoryId) score += 50;
  if (filters.brand && product.brand && normalize(product.brand) === normalize(filters.brand)) {
    score += 30;
  }

  if (filters.text) {
    const words = filters.text.split(/\s+/).filter(Boolean);
    for (const word of words) {
      const w = stem(word);
      if (nameStems.includes(w)) score += 12;
      else if (name.includes(normalize(word))) score += 6;
    }
  }

  let priceBonus = 0;
  if (filters.priceMax !== null && product.price <= filters.priceMax) priceBonus += 5;
  if (filters.priceMin !== null && product.price >= filters.priceMin) priceBonus += 5;

  // Preço sozinho só gera relevância quando é o único filtro do pedido.
  const anchored = Boolean(filters.categoryId || filters.brand || filters.text);
  if (score > 0) return score + priceBonus;
  return anchored ? 0 : priceBonus;
}

/** Aplica os filtros de preço e ordena por relevância (depois nome). */
export function rankProducts(
  products: readonly ProductSearchItem[],
  filters: ProductSearchFilters,
  limit = PRODUCT_SEARCH_LIMIT,
): ProductSearchItem[] {
  return products
    .filter((p) => (filters.priceMax === null ? true : p.price <= filters.priceMax))
    .filter((p) => (filters.priceMin === null ? true : p.price >= filters.priceMin))
    .map((product) => ({ product, score: scoreProduct(product, filters) }))
    .filter((row) => row.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.product.price - b.product.price ||
        a.product.name.localeCompare(b.product.name, "pt-BR"),
    )
    .slice(0, Math.max(0, limit))
    .map((row) => row.product);
}

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );
}

/** Descrição curta do que foi entendido (transparência para o cliente). */
export function describeFilters(filters: ProductSearchFilters): string {
  const parts: string[] = [];
  if (filters.categoryName) parts.push(filters.categoryName);
  if (filters.brand) parts.push(filters.brand);
  if (filters.text) parts.push(filters.text);
  if (filters.priceMin !== null) parts.push(`acima de ${money(filters.priceMin)}`);
  if (filters.priceMax !== null) parts.push(`até ${money(filters.priceMax)}`);
  return parts.join(" · ");
}

export function formatSearchResultsMessage(
  filters: ProductSearchFilters,
  products: readonly ProductSearchItem[],
): string {
  const described = describeFilters(filters);
  if (products.length === 0) {
    return [
      described ? `Não encontrei produtos para *${described}*.` : "Não encontrei produtos com esse pedido.",
      "",
      "_Digite *voltar* para ver as categorias._",
    ].join("\n");
  }
  return [
    described ? `*Encontrei para ${described}:*` : "*Encontrei estas opções:*",
    "",
    ...products.map((p) => `• ${p.name}${p.brand ? ` (${p.brand})` : ""} — ${money(p.price)}`),
    "",
    "_Digite *voltar* para ver as categorias._",
  ].join("\n");
}
