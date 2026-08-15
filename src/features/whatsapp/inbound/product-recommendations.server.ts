/**
 * Consulta das recomendações de produtos semelhantes — server-only.
 *
 * Lê SOMENTE produtos ativos já cadastrados (e a foto principal existente).
 * Nada é criado ou alterado: sem venda, sem estoque, sem carrinho,
 * sem financeiro, sem CRM. Todo o ranking vive no módulo puro.
 */
import type { CatalogNavState } from "./catalog-nav";
import { getCartSession } from "./cart-session.server";
import { resolveContextProductId } from "./product-photos";
import {
  MAX_RECOMMENDATIONS,
  NO_RECOMMENDATIONS_MESSAGE,
  formatRecommendationCaption,
  formatRecommendationsMessage,
  isAlternativeRequestIntent,
  parsePriceDirection,
  rankRecommendations,
  type RecommendationItem,
} from "./product-recommendations";

type Db = { from: (t: string) => any };
type Storage = {
  from: (bucket: string) => {
    createSignedUrls: (
      paths: string[],
      expiresIn: number,
    ) => Promise<{ data: Array<{ path?: string | null; signedUrl?: string | null }> | null }>;
  };
};

const BUCKET = "product-images";
const SIGNED_URL_TTL = 3600;

interface ProductRow {
  id: string;
  name: string;
  price: number | string;
  brand: string | null;
  category_id: string | null;
  unit: string | null;
  cover_image_path: string | null;
}

function toItem(row: ProductRow): RecommendationItem {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    brand: row.brand ?? null,
    categoryId: row.category_id ?? null,
    unit: row.unit ?? null,
    coverImagePath: row.cover_image_path ?? null,
  };
}

/** Produtos ativos com foto principal (leitura pura). */
export async function listActiveRecommendationCandidates(
  db: Db,
  companyId: string,
): Promise<RecommendationItem[]> {
  const { data } = await db
    .from("products")
    .select("id, name, price, brand, category_id, unit, cover_image_path")
    .eq("company_id", companyId)
    .eq("status", "active")
    .gt("stock", 0)
    .order("name");
  return ((data ?? []) as ProductRow[]).map(toItem);
}

async function signCovers(
  storage: Storage | undefined,
  paths: string[],
): Promise<Map<string, string>> {
  const byPath = new Map<string, string>();
  if (!storage || paths.length === 0) return byPath;
  const { data } = await storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
  for (const d of data ?? []) {
    if (d?.path && d?.signedUrl) byPath.set(d.path, d.signedUrl);
  }
  return byPath;
}

export interface RecommendationMedia {
  productId: string;
  imageUrl: string;
  caption: string;
}

export interface RecommendationTurnResult {
  text: string;
  products: RecommendationItem[];
  /** Fotos principais assinadas (uma por produto, quando cadastrada). */
  media: RecommendationMedia[];
  state: CatalogNavState | null;
}

/**
 * Resolve o turno de recomendação. Retorna `null` quando a mensagem não é
 * um pedido de alternativa ou quando não há produto em contexto
 * (inclusive contexto expirado) — o fluxo normal segue.
 */
export async function handleRecommendationTurn(args: {
  db: Db;
  storage?: Storage;
  companyId: string;
  phone: string;
  text: string;
  state?: CatalogNavState | null;
  now?: number;
}): Promise<RecommendationTurnResult | null> {
  if (!isAlternativeRequestIntent(args.text)) return null;

  const state = args.state ?? null;
  const session = await getCartSession(args.companyId, args.phone, args.now ?? Date.now());
  const productId = resolveContextProductId({ state, session, now: args.now });
  if (!productId) return null;

  const candidates = await listActiveRecommendationCandidates(args.db, args.companyId);
  const current = candidates.find((p) => p.id === productId) ?? null;
  if (!current) return null;

  const products = rankRecommendations({
    current,
    candidates,
    direction: parsePriceDirection(args.text),
    limit: MAX_RECOMMENDATIONS,
  });

  if (products.length === 0) {
    return { text: NO_RECOMMENDATIONS_MESSAGE, products: [], media: [], state };
  }

  const paths = products
    .map((p) => p.coverImagePath)
    .filter((p): p is string => Boolean(p));
  const signed = await signCovers(args.storage, paths);

  const media: RecommendationMedia[] = products
    .map((p) => {
      const url = p.coverImagePath ? signed.get(p.coverImagePath) : undefined;
      return url
        ? { productId: p.id, imageUrl: url, caption: formatRecommendationCaption(p) }
        : null;
    })
    .filter((m): m is RecommendationMedia => m !== null);

  return {
    text: formatRecommendationsMessage(products),
    products,
    media,
    state: {
      ...(state ?? {}),
      step: state?.step ?? "products",
      lastProductIds: products.map((p) => p.id),
    },
  };
}
