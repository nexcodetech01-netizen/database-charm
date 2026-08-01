/**
 * Consulta e orquestração da navegação de catálogo por categorias.
 * Server-only — usa o client admin já resolvido pelo roteador inbound.
 *
 * Não cria tabelas nem cadastros: lê apenas `product_categories` e `products`.
 */
import {
  formatCategoriesMessage,
  formatProductsMessage,
  isBackIntent,
  isCatalogIntent,
  matchCategory,
  type CatalogCategoryOption,
  type CatalogNavState,
  type CatalogProductOption,
} from "./catalog-nav";
import { handleProductSearchTurn, listActiveProducts } from "./product-search.server";
import {
  addToCart,
  formatAddedMessage,
  formatCartMessage,
  formatClearedMessage,
  formatRemovedMessage,
  hasAddIntent,
  matchProduct,
  parseCartCommand,
  parseQuantity,
  removeFromCart,
  type CartLine,
} from "./cart";

type Db = { from: (t: string) => any };

export async function listCategoriesWithActiveProducts(
  db: Db,
  companyId: string,
): Promise<CatalogCategoryOption[]> {
  const { data: rows } = await db
    .from("products")
    .select("category_id")
    .eq("company_id", companyId)
    .eq("status", "active")
    .not("category_id", "is", null);

  const counts = new Map<string, number>();
  for (const r of (rows ?? []) as { category_id: string | null }[]) {
    if (!r.category_id) continue;
    counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1);
  }
  if (counts.size === 0) return [];

  const { data: cats } = await db
    .from("product_categories")
    .select("id, name, icon, status")
    .eq("company_id", companyId)
    .in("id", Array.from(counts.keys()))
    .order("name");

  return ((cats ?? []) as { id: string; name: string; icon: string | null; status: string }[])
    .filter((c) => c.status !== "archived")
    .map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon ?? null,
      productCount: counts.get(c.id) ?? 0,
    }));
}

export async function listActiveProductsByCategory(
  db: Db,
  companyId: string,
  categoryId: string,
): Promise<CatalogProductOption[]> {
  const { data } = await db
    .from("products")
    .select("id, name, price, unit")
    .eq("company_id", companyId)
    .eq("status", "active")
    .eq("category_id", categoryId)
    .order("name");

  return ((data ?? []) as { id: string; name: string; price: number | string; unit: string | null }[]).map(
    (p) => ({ id: p.id, name: p.name, price: Number(p.price), unit: p.unit ?? null }),
  );
}

export interface CatalogTurnResult {
  text: string;
  state: CatalogNavState | null;
}

/**
 * Resolve o turno de catálogo. Retorna `null` quando a mensagem não pertence
 * ao fluxo de catálogo (aí o roteador segue para o Action Engine normal).
 */
export async function handleCatalogTurn(args: {
  db: Db;
  companyId: string;
  text: string;
  state: CatalogNavState | null | undefined;
}): Promise<CatalogTurnResult | null> {
  const { db, companyId, text } = args;
  const state = args.state ?? null;
  const inCatalog = Boolean(state);
  const cart: CartLine[] = state?.cart ?? [];
  const keep = (next: CatalogNavState | null): CatalogNavState | null =>
    next ? { ...next, cart: next.cart ?? cart } : null;

  // Comandos do pedido conversacional (ver / limpar / remover).
  const command = parseCartCommand(text);
  if (command && (inCatalog || cart.length > 0 || command.kind === "view")) {
    if (command.kind === "view") {
      return { text: formatCartMessage(cart), state: keep({ step: "cart" }) };
    }
    if (command.kind === "clear") {
      return {
        text: formatClearedMessage(),
        state: { ...(state ?? { step: "cart" }), step: "cart", cart: [] },
      };
    }
    const { cart: nextCart, removed } = removeFromCart(cart, command.text);
    if (removed) {
      return {
        text: formatRemovedMessage(removed, nextCart),
        state: { ...(state ?? { step: "cart" }), step: "cart", cart: nextCart },
      };
    }
  }

  const wantsCategories =
    isCatalogIntent(text) || (inCatalog && isBackIntent(text));

  if (wantsCategories) {
    const categories = await listCategoriesWithActiveProducts(db, companyId);
    return {
      text: formatCategoriesMessage(categories),
      state: keep(
        categories.length > 0
          ? { step: "categories", categoryIds: categories.map((c) => c.id) }
          : null,
      ),
    };
  }

  const categories = await listCategoriesWithActiveProducts(db, companyId);
  if (categories.length === 0) return null;

  // Adicionar produto ao pedido: nome do produto (ativo) na mensagem.
  const activeProducts = await listActiveProducts(db, companyId);
  const productHit = matchProduct(text, activeProducts);
  if (productHit && (inCatalog || hasAddIntent(text))) {
    const nextCart = addToCart(cart, productHit, parseQuantity(text));
    return {
      text: formatAddedMessage(nextCart),
      state: {
        step: "cart",
        categoryIds: categories.map((c) => c.id),
        categoryId: productHit.categoryId ?? undefined,
        cart: nextCart,
      },
    };
  }

  // Escolha por número/nome só vale dentro do fluxo de catálogo.
  const chosen = inCatalog ? matchCategory(text, categories) : null;
  if (chosen) {
    const products = await listActiveProductsByCategory(db, companyId, chosen.id);
    return {
      text: formatProductsMessage(chosen.name, products),
      state: keep({
        step: "products",
        categoryId: chosen.id,
        categoryIds: categories.map((c) => c.id),
      }),
    };
  }

  // Sprint 6.7 — busca inteligente: só produtos ativos, sem tocar no cadastro.
  const search = await handleProductSearchTurn({
    db,
    companyId,
    text,
    categories,
    inCatalog,
  });
  return search ? { text: search.text, state: keep(search.state) } : null;
}
