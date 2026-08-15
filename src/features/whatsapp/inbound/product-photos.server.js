import { formatAfterPhotosMessage, isPhotoRequestIntent, MAX_PRODUCT_PHOTOS, NO_PHOTOS_MESSAGE, resolveContextProductId, selectPhotos, } from "./product-photos";
import { getCartSession } from "./cart-session.server";
const BUCKET = "product-images";
const SIGNED_URL_TTL = 3600;
export async function listProductPhotos(db, companyId, productId) {
    const { data } = await db
        .from("product_images")
        .select("id, path, position")
        .eq("company_id", companyId)
        .eq("product_id", productId)
        .order("position");
    return selectPhotos((data ?? []), MAX_PRODUCT_PHOTOS);
}
async function signAll(storage, paths) {
    if (!storage || paths.length === 0)
        return [];
    const { data } = await storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
    const byPath = new Map();
    for (const d of data ?? []) {
        if (d?.path && d?.signedUrl)
            byPath.set(d.path, d.signedUrl);
    }
    // Preserva a ordem cadastrada.
    return paths.map((p) => byPath.get(p)).filter((u) => Boolean(u));
}
/**
 * Resolve o turno de fotos. Retorna `null` quando a mensagem não é um pedido
 * de foto — aí o fluxo segue normalmente (catálogo / Action Engine).
 */
export async function handlePhotoTurn(args) {
    if (!isPhotoRequestIntent(args.text))
        return null;
    const state = args.state ?? null;
    const session = await getCartSession(args.companyId, args.phone, args.now ?? Date.now());
    const productId = resolveContextProductId({ state, session, now: args.now });
    if (!productId)
        return null;
    const photos = await listProductPhotos(args.db, args.companyId, productId);
    if (photos.length === 0) {
        return { text: NO_PHOTOS_MESSAGE, images: [], state };
    }
    const urls = await signAll(args.storage, photos.map((p) => p.path));
    if (urls.length === 0) {
        return { text: NO_PHOTOS_MESSAGE, images: [], state };
    }
    return { text: formatAfterPhotosMessage(), images: urls, state };
}
