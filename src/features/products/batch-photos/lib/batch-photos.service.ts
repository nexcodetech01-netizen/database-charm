import { supabase } from "@/integrations/supabase/client";
import { productImagesService } from "../../services/product-images.service";
import { describeVariant } from "../../lib/product-identity";

export interface PhotoCandidate {
  id: string;
  name: string;
  sku: string | null;
  created_at: string;
  variant: string;
  hasPhoto: boolean;
  photoCount: number;
  categoryId: string | null;
  categoryName: string | null;
  brand: string | null;
  color: string | null;
  size: string | null;
  stock: number;
}

/**
 * Produtos ativos para ligar às fotos. Os sem foto vêm marcados — são as
 * sugestões; os com foto também aparecem (para acrescentar fotos), depois.
 */
export async function listPhotoCandidates(companyId: string): Promise<PhotoCandidate[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, sku, created_at, brand, model, color, size, stock, category_id, category:product_categories(name), cover_image_path, image_url, product_images(count)",
    )
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []).map((p) => {
    const count = Array.isArray(p.product_images)
      ? Number((p.product_images[0] as { count?: number } | undefined)?.count ?? 0)
      : 0;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku ?? null,
      created_at: p.created_at,
      variant: describeVariant(p),
      hasPhoto: count > 0 || !!p.cover_image_path || !!p.image_url,
      photoCount: count,
      categoryId: (p as { category_id?: string | null }).category_id ?? null,
      categoryName:
        ((p as { category?: { name?: string } | null }).category?.name as string | undefined) ?? null,
      brand: (p as { brand?: string | null }).brand ?? null,
      color: p.color ?? null,
      size: p.size ?? null,
      stock: Number((p as { stock?: number | string }).stock ?? 0),
    };
  });
}

export { compressPhoto } from "../../lib/compress-photo";
import { compressPhoto } from "../../lib/compress-photo";

/**
 * Envia as fotos de UMA peça para o produto. A capa (coverIndex) vai
 * primeiro; se o produto ainda não tem capa, ela vira a capa do produto.
 * As fotos que o produto já tinha são mantidas.
 */
export async function attachPhotosToProduct(params: {
  companyId: string;
  productId: string;
  files: File[];
  coverIndex: number;
}): Promise<number> {
  const { companyId, productId, files } = params;
  if (files.length === 0) return 0;
  const coverIndex = Math.min(Math.max(0, params.coverIndex), files.length - 1);
  const ordered = [files[coverIndex], ...files.filter((_, i) => i !== coverIndex)];

  const [{ data: product, error: pErr }, existing] = await Promise.all([
    supabase.from("products").select("cover_image_path").eq("id", productId).maybeSingle(),
    productImagesService.list(productId),
  ]);
  if (pErr) throw pErr;
  const hasCover = !!product?.cover_image_path || existing.length > 0;

  let position = existing.length;
  let coverPath: string | null = null;
  for (const original of ordered) {
    const file = await compressPhoto(original);
    const path = await productImagesService.upload(companyId, productId, file);
    await productImagesService.createRecord(companyId, productId, path, position++);
    if (!coverPath) coverPath = path;
  }

  if (!hasCover && coverPath) {
    const { error } = await supabase
      .from("products")
      .update({ cover_image_path: coverPath })
      .eq("id", productId);
    if (error) throw error;
  }
  return ordered.length;
}
