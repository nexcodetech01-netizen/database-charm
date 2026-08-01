/**
 * Resolução e envio de fotos do produto em contexto — server-only.
 *
 * Lê exclusivamente `product_images` (imagens já cadastradas) e assina URLs
 * no bucket existente. Não escreve nada: sem alteração de banco, cadastro,
 * catálogo, carrinho, financeiro, estoque ou CRM.
 */
import type { CatalogNavState } from "./catalog-nav";
import {
  formatAfterPhotosMessage,
  isPhotoRequestIntent,
  MAX_PRODUCT_PHOTOS,
  NO_PHOTOS_MESSAGE,
  resolveContextProductId,
  selectPhotos,
  type ProductImageRow,
} from "./product-photos";
import { getCartSession } from "./cart-session.server";

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

export interface PhotoTurnResult {
  /** Legenda/resposta em texto. */
  text: string;
  /** URLs assinadas das imagens (máx. 5, na ordem cadastrada). */
  images: string[];
  state: CatalogNavState | null;
}

export async function listProductPhotos(
  db: Db,
  companyId: string,
  productId: string,
): Promise<ProductImageRow[]> {
  const { data } = await db
    .from("product_images")
    .select("id, path, position")
    .eq("company_id", companyId)
    .eq("product_id", productId)
    .order("position");
  return selectPhotos((data ?? []) as ProductImageRow[], MAX_PRODUCT_PHOTOS);
}

async function signAll(storage: Storage | undefined, paths: string[]): Promise<string[]> {
  if (!storage || paths.length === 0) return [];
  const { data } = await storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
  const byPath = new Map<string, string>();
  for (const d of data ?? []) {
    if (d?.path && d?.signedUrl) byPath.set(d.path, d.signedUrl);
  }
  // Preserva a ordem cadastrada.
  return paths.map((p) => byPath.get(p)).filter((u): u is string => Boolean(u));
}

/**
 * Resolve o turno de fotos. Retorna `null` quando a mensagem não é um pedido
 * de foto — aí o fluxo segue normalmente (catálogo / Action Engine).
 */
export async function handlePhotoTurn(args: {
  db: Db;
  storage?: Storage;
  companyId: string;
  phone: string;
  text: string;
  state?: CatalogNavState | null;
  now?: number;
}): Promise<PhotoTurnResult | null> {
  if (!isPhotoRequestIntent(args.text)) return null;

  const state = args.state ?? null;
  const session = getCartSession(args.companyId, args.phone, args.now ?? Date.now());
  const productId = resolveContextProductId({ state, session, now: args.now });
  if (!productId) return null;

  const photos = await listProductPhotos(args.db, args.companyId, productId);
  if (photos.length === 0) {
    return { text: NO_PHOTOS_MESSAGE, images: [], state };
  }

  const urls = await signAll(
    args.storage,
    photos.map((p) => p.path),
  );
  if (urls.length === 0) {
    return { text: NO_PHOTOS_MESSAGE, images: [], state };
  }

  return { text: formatAfterPhotosMessage(), images: urls, state };
}
