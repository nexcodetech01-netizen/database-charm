/**
 * Envio inteligente de fotos de produto (Bella / WhatsApp).
 *
 * Camada PURA: só detecta a intenção, resolve o produto em contexto,
 * ordena/limita as imagens já cadastradas e formata as mensagens.
 *
 * NÃO altera banco, cadastro de produtos, catálogo, carrinho,
 * financeiro, estoque ou CRM. Nenhuma intenção nova é criada:
 * reutiliza o contexto conversacional existente (Etapa 2/3).
 */
import type { CatalogNavState } from "./catalog-nav";
import { normalize } from "./catalog-nav";
import { isCartSessionExpired, type CartSession } from "./cart-session";

/** Máximo de imagens enviadas por vez. */
export const MAX_PRODUCT_PHOTOS = 5;

const PHOTO_RE =
  /\b(mais fotos?|manda(r)? (uma )?fotos?|envia(r)? (as )?(fotos?|imagens?|imagem)|outras fotos?|tem fotos?|ver fotos?|ver (mais )?imagens?|mostra(r)? (mais|atras|de tras|o produto|detalhes)|quero ver (mais|detalhes|fotos?|imagens?)|ver detalhes|foto|fotos|imagens)\b/;

/** Reconhece pedidos de foto do produto em contexto. */
export function isPhotoRequestIntent(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  return PHOTO_RE.test(t);
}

export interface ProductImageRow {
  id?: string;
  path: string;
  position?: number | null;
}

/** Ordena pela ordem cadastrada e aplica o limite máximo. */
export function selectPhotos(
  images: ProductImageRow[],
  limit: number = MAX_PRODUCT_PHOTOS,
): ProductImageRow[] {
  return [...(images ?? [])]
    .filter((i) => Boolean(i?.path))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .slice(0, Math.max(0, limit));
}

export const NO_PHOTOS_MESSAGE =
  "No momento esse produto não possui fotos adicionais cadastradas, mas posso tirar dúvidas ou mostrar modelos parecidos.";

export function formatAfterPhotosMessage(): string {
  return [
    "Gostou? 😊",
    "",
    "Posso:",
    "",
    "🛍️ Adicionar ao pedido",
    "",
    "🎨 Mostrar outra cor (se existir)",
    "",
    "👜 Mostrar outro modelo parecido",
  ].join("\n");
}

/**
 * Último produto da conversa: o último exibido (Etapa 2) ou, na falta dele,
 * o último item adicionado ao carrinho efêmero (Etapa 3).
 */
export function resolveContextProductId(args: {
  state?: CatalogNavState | null;
  session?: CartSession | null;
  now?: number;
}): string | null {
  const now = args.now ?? Date.now();
  const last = args.state?.lastProductIds ?? [];
  if (last.length === 1) return last[0]!;

  const session = args.session;
  if (session && !isCartSessionExpired(session, now) && session.items.length > 0) {
    return session.items[session.items.length - 1]!.productId;
  }
  return null;
}
