import { supabase } from "@/integrations/supabase/client";

/**
 * Busca a categoria pelo nome (case-insensitive) dentro da empresa.
 * Se não existir, cria e retorna o id.
 */
export async function ensureCategoryByName(
  companyId: string,
  name: string,
): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return null;

  const { data: existing, error: findErr } = await supabase
    .from("product_categories")
    .select("id")
    .eq("company_id", companyId)
    .ilike("name", clean)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing?.id) return existing.id;

  const { data: created, error: insErr } = await supabase
    .from("product_categories")
    .insert({ company_id: companyId, name: clean })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return created.id;
}
