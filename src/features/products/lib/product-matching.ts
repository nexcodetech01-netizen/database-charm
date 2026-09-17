import { supabase } from "@/integrations/supabase/client";

export interface ProductNameMatch {
  id: string;
  name: string;
  sku: string | null;
  cost: number | null;
  stock: number | null;
  unit: string | null;
  cover_image_path: string | null;
}

/**
 * Procura produtos já existentes cujo nome "normalizado" bate com o nome
 * informado — mesma normalização (minúsculas, sem acento, só letras/
 * números) que a ferramenta de mesclagem de duplicados
 * (`preview_duplicate_products`/`merge_duplicate_products`) já usa pra
 * decidir o que é o "mesmo produto". Usado pra avisar ANTES de criar um
 * produto novo (linha manual ou item importado numa compra), em vez de só
 * limpar duplicatas depois que elas já viraram estoque/histórico
 * bagunçado.
 *
 * Retorna [] em qualquer erro ou nome vazio — é uma sugestão, nunca deve
 * travar o fluxo de lançar a compra.
 */
export async function findProductsByNameKey(
  companyId: string,
  name: string,
): Promise<ProductNameMatch[]> {
  const trimmed = name.trim();
  if (!trimmed || !companyId) return [];

  const { data, error } = await supabase.rpc("find_products_by_name_key", {
    company_id_param: companyId,
    name_param: trimmed,
    limit_param: 5,
  });

  if (error) {
    console.error("findProductsByNameKey error:", error);
    return [];
  }

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    cost: p.cost != null ? Number(p.cost) : null,
    stock: p.stock != null ? Number(p.stock) : null,
    unit: p.unit ?? null,
    cover_image_path: p.cover_image_path ?? null,
  }));
}
