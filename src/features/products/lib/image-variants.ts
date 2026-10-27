/**
 * Versões leves das fotos de produto (27/10/2026).
 *
 * O plano gratuito do Supabase não redimensiona imagem; as listas pediam
 * a versão "transformada", recebiam erro e caíam na foto ORIGINAL (vários
 * MB) — o egress estourou. Agora, junto de cada foto, guardamos duas
 * versões WebP prontas: 400 px (listas, PDV, cartões) e 1200 px (página
 * do produto). Ficam ao lado da original: `<caminho>.w400.webp`.
 */
export const VARIANT_WIDTHS = [400, 1200] as const;
export type VariantWidth = (typeof VARIANT_WIDTHS)[number];

const VARIANT_RE = /\.w(\d+)\.webp$/;

export function variantPath(path: string, width: VariantWidth): string {
  return `${path}.w${width}.webp`;
}

export function isVariantPath(path: string): boolean {
  return VARIANT_RE.test(path);
}

/** Menor versão que atende a largura pedida (em px de tela já com 2x). */
export function pickVariant(width: number): VariantWidth | null {
  if (!Number.isFinite(width) || width <= 0) return null;
  return VARIANT_WIDTHS.find((w) => width <= w) ?? null;
}

/** Gera uma versão WebP com o lado maior em `maxSide` px. */
export async function makeVariant(source: Blob, maxSide: number): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(source);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", maxSide <= 400 ? 0.78 : 0.84),
    );
  } catch {
    return null;
  }
}
