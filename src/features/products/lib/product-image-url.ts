import { supabase } from "@/integrations/supabase/client";

/**
 * URL pública de uma imagem de produto a partir do path salvo no banco
 * (`products.cover_image_path`). Extraído pra um lugar único porque essa
 * mesma conta de 4 linhas (storage.from("product-images").getPublicUrl)
 * estava reimplementada em múltiplos componentes — não é lógica de
 * negócio, mas é exatamente o tipo de duplicação que já causou dor de
 * cabeça neste projeto quando um dos lugares fica desatualizado.
 */
export function productImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl ?? null;
}
