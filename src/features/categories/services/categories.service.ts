import { supabase } from "@/integrations/supabase/client";
import type { CategoryInsert, CategoryUpdate, CategoryWithMeta } from "../types";
import { findEquivalentCategory } from "../lib/category-name-key";

/** Erro amigável quando já existe categoria equivalente. */
export class DuplicateCategoryError extends Error {
  constructor(public readonly existingName: string) {
    super(
      `Já existe a categoria "${existingName}" equivalente a esse nome. Utilize a categoria existente.`,
    );
    this.name = "DuplicateCategoryError";
  }
}

async function assertNoEquivalent(companyId: string, name: string, ignoreId?: string) {
  const { data, error } = await supabase
    .from("product_categories")
    .select("id, name")
    .eq("company_id", companyId);
  if (error) throw error;
  const hit = findEquivalentCategory(data ?? [], name, ignoreId);
  if (hit) throw new DuplicateCategoryError(hit.name);
}


export const categoriesService = {
  /**
   * Lista categorias com contagem de produtos vinculados.
   * Retorna todas (ativas e arquivadas); o filtro é aplicado no hook/UI.
   */
  async listWithCounts(companyId: string): Promise<CategoryWithMeta[]> {
    const { data, error } = await supabase
      .from("product_categories")
      .select("*, products:products(id)")
      .eq("company_id", companyId)
      .order("name");
    if (error) throw error;

    return (data ?? []).map((row) => {
      const { products, ...rest } = row as typeof row & {
        products: { id: string }[] | null;
      };
      return {
        ...rest,
        product_count: products?.length ?? 0,
      } as CategoryWithMeta;
    });
  },

  async create(input: CategoryInsert) {
    await assertNoEquivalent(input.company_id, input.name);
    const { data, error } = await supabase
      .from("product_categories")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: CategoryUpdate) {
    if (input.name) {
      const { data: current } = await supabase
        .from("product_categories")
        .select("company_id")
        .eq("id", id)
        .maybeSingle();
      if (current?.company_id) {
        await assertNoEquivalent(current.company_id, input.name, id);
      }
    }
    const { data, error } = await supabase
      .from("product_categories")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Prévia (READ-ONLY) dos grupos de categorias equivalentes da empresa. */
  async previewDuplicates(companyId: string) {
    const { data, error } = await supabase.rpc("preview_duplicate_categories", {
      _company_id: companyId,
    });
    if (error) throw error;
    return (data ?? []) as unknown as DuplicateGroupRow[];
  },

  /** Unifica a categoria de origem na de destino (após confirmação do usuário). */
  async merge(sourceId: string, targetId: string, confirmPolicyConflict = false) {
    const { data, error } = await supabase.rpc("merge_product_categories", {
      _source_id: sourceId,
      _target_id: targetId,
      _confirm_policy_conflict: confirmPolicyConflict,
    });
    if (error) throw error;
    return data as unknown as MergeResult;
  },


  async archive(id: string) {
    return this.update(id, { status: "archived" });
  },

  async restore(id: string) {
    return this.update(id, { status: "active" });
  },

  /** Remove definitivamente uma categoria (apenas se estiver vazia). */
  async remove(id: string) {
    const { error } = await supabase.from("product_categories").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
};
