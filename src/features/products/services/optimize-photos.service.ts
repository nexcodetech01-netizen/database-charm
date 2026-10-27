import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabase-fetch-all";
import { compressPhoto } from "../lib/compress-photo";
import { VARIANT_WIDTHS, isVariantPath, variantPath } from "../lib/image-variants";
import { productImagePublicUrl, uploadImageVariants } from "./product-images.service";

const BUCKET = "product-images";
/** Original acima disso é recomprimida (foto de celular sem compressão). */
const HEAVY_BYTES = 700 * 1024;

export interface OptimizeProgress {
  done: number;
  total: number;
  optimized: number;
  failed: number;
}

/** Fotos da empresa que ainda não têm as versões leves. */
export async function listPhotosToOptimize(companyId: string): Promise<string[]> {
  const images = (await fetchAllRows(
    supabase.from("product_images").select("id, path").eq("company_id", companyId),
  )) as { path: string | null }[];
  const covers = (await fetchAllRows(
    supabase
      .from("products")
      .select("id, cover_image_path")
      .eq("company_id", companyId)
      .not("cover_image_path", "is", null),
  )) as { cover_image_path: string | null }[];

  const all = new Set<string>();
  for (const r of images) if (r.path && !isVariantPath(r.path)) all.add(r.path);
  for (const r of covers) {
    const p = r.cover_image_path;
    if (p && !/^https?:/i.test(p) && !isVariantPath(p)) all.add(p);
  }

  // Lista cada pasta uma vez para saber quais versões já existem.
  const byFolder = new Map<string, string[]>();
  for (const p of all) {
    const i = p.lastIndexOf("/");
    const folder = i >= 0 ? p.slice(0, i) : "";
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), p]);
  }
  const pending: string[] = [];
  for (const [folder, paths] of byFolder) {
    const { data } = await supabase.storage.from(BUCKET).list(folder, { limit: 1000 });
    const names = new Set((data ?? []).map((f) => (folder ? `${folder}/${f.name}` : f.name)));
    for (const p of paths) {
      if (!names.has(p)) continue; // foto apagada do storage: nada a fazer
      if (VARIANT_WIDTHS.some((w) => !names.has(variantPath(p, w)))) pending.push(p);
    }
  }
  return pending;
}

async function optimizeOne(path: string): Promise<void> {
  const res = await fetch(productImagePublicUrl(path), { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  let source: Blob = blob;
  // Original pesada: troca pela versão comprimida (mesmo caminho).
  if (blob.size > HEAVY_BYTES) {
    const light = await compressPhoto(
      new File([blob], "foto", { type: blob.type || "image/jpeg" }),
    );
    if (light.size < blob.size) {
      const { error } = await supabase.storage.from(BUCKET).upload(path, light, {
        upsert: true,
        contentType: light.type,
        cacheControl: "31536000",
      });
      if (!error) source = light;
    }
  }
  const ok = await uploadImageVariants(path, source);
  if (!ok) throw new Error("Falha ao gerar versões leves");
}

/** Otimiza as fotos, 3 de cada vez, avisando o progresso. */
export async function optimizePhotos(
  paths: string[],
  onProgress: (p: OptimizeProgress) => void,
): Promise<OptimizeProgress> {
  const state: OptimizeProgress = { done: 0, total: paths.length, optimized: 0, failed: 0 };
  onProgress({ ...state });
  let next = 0;
  async function worker() {
    while (next < paths.length) {
      const path = paths[next++];
      try {
        await optimizeOne(path);
        state.optimized++;
      } catch {
        state.failed++;
      }
      state.done++;
      onProgress({ ...state });
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return state;
}
