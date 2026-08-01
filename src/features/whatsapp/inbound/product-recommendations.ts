/**
 * Recomendação de produtos semelhantes (Sprint 6.7 — Etapa 5).
 *
 * Camada PURA e determinística: detecta o pedido de alternativa,
 * ranqueia produtos ativos já cadastrados e formata a resposta.
 *
 * Sem IA externa. Não altera banco, cadastro, catálogo, carrinho,
 * financeiro, estoque ou CRM. Nenhuma intenção nova é criada:
 * reutiliza o contexto conversacional existente (Etapa 2/3/4).
 */
import { normalize } from "./catalog-nav";
import type { ProductSearchItem } from "./product-search";

export const MAX_RECOMMENDATIONS = 5;

/** Direção de preço pedida pelo cliente. */
export type PriceDirection = "cheaper" | "pricier" | null;

const REJECT_RE =
  /\b(nao gostei|nao curti|nao quero (esse|essa|este|esta)|tem outr[oa]|tem mais algum|outra opcao|outras opcoes|mostra(r)? outr[oa]|quero outr[oa]|tem outr[oa] parecid[oa]|algo parecido|parecido|semelhante|similar|mais barat[oa]|mais car[oa])\b/;

const CHEAPER_RE = /\bmais barat[oa]s?\b|\bmenos car[oa]s?\b|\bmais em conta\b/;
const PRICIER_RE = /\bmais car[oa]s?\b|\bmelhor qualidade\b|\bmais top\b/;

/** Reconhece rejeição ou pedido de alternativa. */
export function isAlternativeRequestIntent(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  return REJECT_RE.test(t);
}

/** Extrai a direção de preço pedida ("mais barato" / "mais caro"). */
export function parsePriceDirection(text: string): PriceDirection {
  const t = normalize(text);
  if (!t) return null;
  if (CHEAPER_RE.test(t)) return "cheaper";
  if (PRICIER_RE.test(t)) return "pricier";
  return null;
}

export interface RecommendationItem extends ProductSearchItem {
  /** Caminho da foto principal já cadastrada (quando existir). */
  coverImagePath?: string | null;
}

export interface RankRecommendationsOptions {
  current: RecommendationItem;
  candidates: readonly RecommendationItem[];
  direction?: PriceDirection;
  limit?: number;
}

/**
 * Ranking determinístico:
 * 1. mesma categoria
 * 2. mesma marca (quando existir)
 * 3. faixa de preço semelhante
 * 4. exclui o produto atual
 * 5. somente produtos ativos (garantido pela consulta)
 */
export function rankRecommendations(
  options: RankRecommendationsOptions,
): RecommendationItem[] {
  const { current, candidates } = options;
  const direction = options.direction ?? null;
  const limit = options.limit ?? MAX_RECOMMENDATIONS;
  const base = Number(current.price) || 0;

  const filtered = candidates.filter((p) => {
    if (!p || p.id === current.id) return false;
    const price = Number(p.price) || 0;
    if (direction === "cheaper" && !(price < base)) return false;
    if (direction === "pricier" && !(price > base)) return false;
    return true;
  });

  const scored = filtered.map((p) => {
    const price = Number(p.price) || 0;
    let score = 0;
    if (current.categoryId && p.categoryId === current.categoryId) score += 100;
    if (
      current.brand &&
      p.brand &&
      normalize(p.brand) === normalize(current.brand)
    ) {
      score += 50;
    }
    // Faixa de preço semelhante: quanto menor o desvio relativo, maior o score.
    const delta = base > 0 ? Math.abs(price - base) / base : 1;
    score += Math.max(0, 25 - Math.min(25, delta * 25));
    return { product: p, score, delta };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.delta - b.delta ||
      a.product.name.localeCompare(b.product.name, "pt-BR"),
  );

  return scored.slice(0, Math.max(0, limit)).map((s) => s.product);
}

export const NO_RECOMMENDATIONS_MESSAGE =
  "No momento não encontrei outro produto parecido, mas posso mostrar outras opções da mesma categoria.";

export const RECOMMENDATIONS_FOOTER = "Algum desses chamou sua atenção? 😊";

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );
}

/** Mensagem de texto com nome e preço de cada recomendação. */
export function formatRecommendationsMessage(
  products: readonly RecommendationItem[],
): string {
  if (products.length === 0) return NO_RECOMMENDATIONS_MESSAGE;
  return [
    "*Separei estas opções parecidas:*",
    "",
    ...products.map((p) => `• ${p.name} — ${money(Number(p.price) || 0)}`),
    "",
    RECOMMENDATIONS_FOOTER,
  ].join("\n");
}

/** Legenda enviada junto da foto principal de cada produto. */
export function formatRecommendationCaption(product: RecommendationItem): string {
  return `${product.name} — ${money(Number(product.price) || 0)}`;
}
