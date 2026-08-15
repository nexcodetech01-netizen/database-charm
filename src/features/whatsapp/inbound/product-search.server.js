/**
 * Consulta da busca inteligente de produtos (Bella inbound).
 * Server-only — lê SOMENTE produtos ativos; nada é criado ou alterado.
 */
import { PRODUCT_SEARCH_LIMIT, formatSearchResultsMessage, hasSearchableFilters, parseProductQuery, rankProducts, } from "./product-search";
/** Produtos ativos da empresa (leitura pura, sem efeitos). */
export async function listActiveProducts(db, companyId) {
    const { data } = await db
        .from("products")
        .select("id, name, price, brand, category_id, unit")
        .eq("company_id", companyId)
        .eq("status", "active")
        .gt("stock", 0)
        .order("name");
    return (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        brand: p.brand ?? null,
        categoryId: p.category_id ?? null,
        unit: p.unit ?? null,
    }));
}
/** Marcas distintas já cadastradas em produtos ativos. */
export function collectBrands(products) {
    const seen = new Map();
    for (const product of products) {
        const brand = product.brand?.trim();
        if (!brand)
            continue;
        const key = brand.toLowerCase();
        if (!seen.has(key))
            seen.set(key, brand);
    }
    return Array.from(seen.values());
}
/**
 * Resolve um turno de busca de produto. Retorna `null` quando a mensagem não
 * traz nenhum filtro reconhecível — o roteador segue o fluxo normal.
 */
export async function handleProductSearchTurn(args) {
    const { db, companyId, text, categories } = args;
    if (!String(text ?? "").trim())
        return null;
    const products = await listActiveProducts(db, companyId);
    if (products.length === 0)
        return null;
    const filters = parseProductQuery(text, {
        categories,
        brands: collectBrands(products),
    });
    if (!hasSearchableFilters(filters))
        return null;
    const anchored = Boolean(filters.categoryId || filters.brand);
    if (!anchored && !args.inCatalog)
        return null;
    const ranked = rankProducts(products, filters, args.limit ?? PRODUCT_SEARCH_LIMIT);
    if (ranked.length === 0 && !anchored)
        return null;
    return {
        text: formatSearchResultsMessage(filters, ranked),
        filters,
        products: ranked,
        state: {
            step: "products",
            categoryId: filters.categoryId ?? undefined,
            categoryIds: categories.map((c) => c.id),
        },
    };
}
