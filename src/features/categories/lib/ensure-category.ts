import { supabase } from "@/integrations/supabase/client";
import { findEquivalentCategory } from "./category-name-key";

/**
 * Busca a categoria equivalente (ignora plural, acentos, caixa e espaços)
 * dentro da empresa. Se não existir, cria e retorna o id.
 * Nunca cria duplicidade: sempre reutiliza a categoria existente.
 */
export async function ensureCategoryByName(
  companyId: string,
  name: string,
): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return null;

  const { data: all, error: findErr } = await supabase
    .from("product_categories")
    .select("id, name")
    .eq("company_id", companyId);
  if (findErr) throw findErr;

  const existing = findEquivalentCategory(all ?? [], clean);
  if (existing?.id) return existing.id;

  const { data: created, error: insErr } = await supabase
    .from("product_categories")
    .insert({ company_id: companyId, name: clean })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return created.id;
}
