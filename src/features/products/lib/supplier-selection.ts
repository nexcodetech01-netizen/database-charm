import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/** Validate the form's selected record without replacing or creating suppliers. */
export async function resolveProductSupplierId(
  companyId: string,
  value: string | null | undefined,
): Promise<string | null> {
  const id = value?.trim();
  if (!id) return null;
  if (!z.string().uuid().safeParse(id).success) {
    throw new Error("Fornecedor inválido. Selecione novamente o fornecedor.");
  }

  const { data, error } = await supabase
    .from("product_suppliers")
    .select("id")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Fornecedor não encontrado nesta empresa. Selecione novamente o fornecedor.");
  }
  return data.id;
}