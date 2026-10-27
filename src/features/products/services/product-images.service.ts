import { supabase } from "@/integrations/supabase/client";
import {
  VARIANT_WIDTHS,
  isVariantPath,
  makeVariant,
  pickVariant,
  variantPath,
} from "../lib/image-variants";

const BUCKET = "product-images";

/**
 * Fotos de produto (27/10/2026): link PÚBLICO e fixo (fica em cache no
 * navegador e na CDN) e versões leves prontas (ver lib/image-variants).
 * Antes eram links assinados (sem cache) e a "transformação" do Supabase,
 * que não existe no plano gratuito — toda lista baixava a foto original.
 */
const PUBLIC_MARK = `/object/public/${BUCKET}/`;
/** Fotos não mudam de conteúdo no mesmo caminho: cache longo. */
const LONG_CACHE = "31536000";

/**
 * Pede a versão leve (400/1200 px) de uma URL pública de foto. Se a versão
 * ainda não existir, o `onError` da imagem volta para a original
 * (withoutImageTransform). URLs de outros tipos voltam como estão.
 */
export function withImageTransform(url: string, width: number): string {
  if (!url || !url.includes(PUBLIC_MARK)) return url;
  const [base, query] = url.split("?");
  if (isVariantPath(base)) return url;
  const v = pickVariant(width);
  if (!v) return url;
  return `${variantPath(base, v)}${query ? `?${query}` : ""}`;
}

/** Volta da versão leve para a foto original (fallback do onError). */
export function withoutImageTransform(url: string): string {
  if (!url) return url;
  const [base, query] = url.split("?");
  const original = base.replace(/\.w\d+\.webp$/, "");
  return original === base ? url : `${original}${query ? `?${query}` : ""}`;
}

export function productImagePublicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Envia as versões leves de uma foto (falha não impede nada). */
export async function uploadImageVariants(path: string, source: Blob): Promise<boolean> {
  let ok = true;
  for (const w of VARIANT_WIDTHS) {
    const blob = await makeVariant(source, w);
    if (!blob) {
      ok = false;
      continue;
    }
    const { error } = await supabase.storage.from(BUCKET).upload(variantPath(path, w), blob, {
      upsert: true,
      contentType: "image/webp",
      cacheControl: LONG_CACHE,
    });
    if (error) ok = false;
  }
  return ok;
}

export const productImagesService = {
  bucket: BUCKET,

  async upload(companyId: string, productId: string, file: File) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${companyId}/${productId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, cacheControl: LONG_CACHE });
    if (error) throw error;
    await uploadImageVariants(path, file).catch(() => false);
    return path;
  },

  async createRecord(companyId: string, productId: string, path: string, position: number) {
    const { data, error } = await supabase
      .from("product_images")
      .insert({ company_id: companyId, product_id: productId, path, position })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Insere uma nova foto principal e preserva a ordem das fotos existentes. */
  async promoteNewMainImage(companyId: string, productId: string, path: string) {
    // Desloca todas as fotos numa única instrução no banco (antes: um
    // UPDATE por foto, em sequência).
    const { error } = await supabase.rpc("shift_product_image_positions", {
      _product_id: productId,
    });
    if (error) throw error;

    return this.createRecord(companyId, productId, path, 0);
  },

  async updateFraming(id: string, framing: { focal_x: number; focal_y: number; zoom: number }) {
    const { data, error } = await supabase
      .from("product_images")
      .update({
        focal_x: framing.focal_x,
        focal_y: framing.focal_y,
        zoom: framing.zoom,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async list(productId: string) {
    const { data, error } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("position");
    if (error) throw error;
    return data ?? [];
  },

  async remove(id: string, path: string) {
    await supabase.storage.from(BUCKET).remove([path]);
    const { error } = await supabase.from("product_images").delete().eq("id", id);
    if (error) throw error;
  },

  /**
   * Link da foto. Mantém o nome antigo ("signed"), mas devolve o link
   * PÚBLICO e fixo (cacheável). Com `width`, aponta para a versão leve.
   */
  async signedUrl(path: string, _expiresIn = 3600, width?: number): Promise<string> {
    const url = productImagePublicUrl(path);
    return width ? withImageTransform(url, width) : url;
  },

  async signedUrls(
    paths: string[],
    _expiresIn = 3600,
    width?: number,
  ): Promise<{ path: string; signedUrl: string }[]> {
    return paths.filter(Boolean).map((path) => {
      const url = productImagePublicUrl(path);
      return { path, signedUrl: width ? withImageTransform(url, width) : url };
    });
  },
};
