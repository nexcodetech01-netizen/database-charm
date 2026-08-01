/**
 * Consulta dos produtos complementares — server-only.
 *
 * Lê SOMENTE produtos ativos já cadastrados (+ vínculos de coleção
 * existentes em `product_collection_items`). Nada é criado ou alterado:
 * sem venda, sem estoque, sem financeiro, sem CRM, sem carrinho.
 * Todo o ranking vive no módulo puro `product-upsell.ts`.
 */
import { getCartSession } from "./cart-session.server";
import {
  MAX_UPSELL_SUGGESTIONS,
  formatUpsellMessage,
  isUpsellTriggerIntent,
  rankUpsell,
  resolveUpsellProductId,
  type UpsellItem,
} from "./product-upsell";

type Db = { from: (t: string) => any };

interface ProductRow {
  id: string;
  name: string;
  price: number | string;
  brand: string | null;
  category_id: string | null;
  unit: string | null;
  status?: string | null;
  cover_image_path?: string | null;
}

/** Produtos ativos (leitura pura). */
export async function listActiveUpsellCandidates(
  db: Db,
  companyId: string,
): Promise<UpsellItem[]> {
  const { data } = await db
    .from("products")
    .select("id, name, price, brand, category_id, unit, status, cover_image_path")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("name");

  const items: UpsellItem[] = ((data ?? []) as ProductRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    price: Number(row.price),
    brand: row.brand ?? null,
    categoryId: row.category_id ?? null,
    unit: row.unit ?? null,
    status: row.status ?? "active",
    coverImagePath: row.cover_image_path ?? null,
    collectionIds: [],
  }));

  if (items.length === 0) return items;

  // Vínculos de coleção já cadastrados (somente leitura).
  const { data: links } = await db
    .from("product_collection_items")
    .select("product_id, collection_id")
    .in(
      "product_id",
      items.map((i) => i.id),
    );

  const byProduct = new Map<string, string[]>();
  for (const l of (links ?? []) as { product_id: string; collection_id: string }[]) {
    const arr = byProduct.get(l.product_id) ?? [];
    arr.push(l.collection_id);
    byProduct.set(l.product_id, arr);
  }
  return items.map((i) => ({ ...i, collectionIds: byProduct.get(i.id) ?? [] }));
}

export interface UpsellTurnResult {
  text: string;
  products: UpsellItem[];
}

/**
 * Resolve o turno de upsell. Retorna `null` quando não houve escolha/adição,
 * quando não há produto em contexto (inclusive contexto expirado) ou quando
 * não existe recomendação — nesses casos o fluxo continua normalmente.
 */
export async function handleUpsellTurn(args: {
  db: Db;
  companyId: string;
  phone: string;
  text: string;
  lastProductIds?: readonly string[] | null;
  complementaryCategoryIds?: readonly string[];
  now?: number;
}): Promise<UpsellTurnResult | null> {
  if (!isUpsellTriggerIntent(args.text)) return null;

  const session = getCartSession(args.companyId, args.phone, args.now ?? Date.now());
  const productId = resolveUpsellProductId({
    lastProductIds: args.lastProductIds ?? null,
    session,
    now: args.now,
  });
  if (!productId) return null;

  const candidates = await listActiveUpsellCandidates(args.db, args.companyId);
  const current = candidates.find((p) => p.id === productId) ?? null;
  if (!current) return null;

  const products = rankUpsell({
    current,
    candidates,
    cartProductIds: session.items.map((i) => i.productId),
    complementaryCategoryIds: args.complementaryCategoryIds ?? [],
    limit: MAX_UPSELL_SUGGESTIONS,
  });
  if (products.length === 0) return null;

  return { text: formatUpsellMessage(products), products };
}
