import { getCartSession } from "./cart-session.server";
import { resolveContextProductId } from "./product-photos";
import { MAX_RECOMMENDATIONS, NO_RECOMMENDATIONS_MESSAGE, formatRecommendationCaption, formatRecommendationsMessage, isAlternativeRequestIntent, parsePriceDirection, rankRecommendations, } from "./product-recommendations";
const BUCKET = "product-images";
const SIGNED_URL_TTL = 3600;
function toItem(row) {
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
export async function listActiveRecommendationCandidates(db, companyId) {
    const { data } = await db
        .from("products")
        .select("id, name, price, brand, category_id, unit, cover_image_path")
        .eq("company_id", companyId)
        .eq("status", "active")
        .gt("stock", 0)
        .order("name");
    return (data ?? []).map(toItem);
}
async function signCovers(storage, paths) {
    const byPath = new Map();
    if (!storage || paths.length === 0)
        return byPath;
    const { data } = await storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
    for (const d of data ?? []) {
        if (d?.path && d?.signedUrl)
            byPath.set(d.path, d.signedUrl);
    }
    return byPath;
}
/**
 * Resolve o turno de recomendação. Retorna `null` quando a mensagem não é
 * um pedido de alternativa ou quando não há produto em contexto
 * (inclusive contexto expirado) — o fluxo normal segue.
 */
export async function handleRecommendationTurn(args) {
    if (!isAlternativeRequestIntent(args.text))
        return null;
    const state = args.state ?? null;
    const session = await getCartSession(args.companyId, args.phone, args.now ?? Date.now());
    const productId = resolveContextProductId({ state, session, now: args.now });
    if (!productId)
        return null;
    const candidates = await listActiveRecommendationCandidates(args.db, args.companyId);
    const current = candidates.find((p) => p.id === productId) ?? null;
    if (!current)
        return null;
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
        .filter((p) => Boolean(p));
    const signed = await signCovers(args.storage, paths);
    const media = products
        .map((p) => {
        const url = p.coverImagePath ? signed.get(p.coverImagePath) : undefined;
        return url
            ? { productId: p.id, imageUrl: url, caption: formatRecommendationCaption(p) }
            : null;
    })
        .filter((m) => m !== null);
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
