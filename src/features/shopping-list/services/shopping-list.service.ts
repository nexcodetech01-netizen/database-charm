import { supabase } from "@/integrations/supabase/client";

export interface ShoppingListItem {
  id: string;
  company_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  notes: string | null;
  checked: boolean;
  checked_at: string | null;
  estimated_price: number | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export const shoppingListService = {
  async list(companyId: string): Promise<ShoppingListItem[]> {
    const { data, error } = await supabase
      .from("shopping_list_items")
      .select("*")
      .eq("company_id", companyId)
      .order("checked", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ShoppingListItem[];
  },

  async add(input: {
    companyId: string;
    name: string;
    quantity?: number;
    notes?: string | null;
    productId?: string | null;
    estimatedPrice?: number | null;
    category?: string | null;
  }): Promise<ShoppingListItem> {
    const name = input.name.trim();
    if (!name) throw new Error("Digite o nome do item.");
    const { data, error } = await supabase
      .from("shopping_list_items")
      .insert({
        company_id: input.companyId,
        name,
        quantity: input.quantity ?? 1,
        notes: input.notes ?? null,
        product_id: input.productId ?? null,
        estimated_price: input.estimatedPrice ?? null,
        category: input.category ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as ShoppingListItem;
  },

  async updateDetails(
    id: string,
    patch: { estimatedPrice?: number | null; category?: string | null },
  ): Promise<ShoppingListItem> {
    const update: { estimated_price?: number | null; category?: string | null } = {};
    if ("estimatedPrice" in patch) update.estimated_price = patch.estimatedPrice ?? null;
    if ("category" in patch) {
      const category = patch.category?.trim();
      update.category = category ? category : null;
    }
    const { data, error } = await supabase
      .from("shopping_list_items")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as ShoppingListItem;
  },


  async toggleChecked(id: string, checked: boolean): Promise<ShoppingListItem> {
    const { data, error } = await supabase
      .from("shopping_list_items")
      .update({ checked, checked_at: checked ? new Date().toISOString() : null })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as ShoppingListItem;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("shopping_list_items").delete().eq("id", id);
    if (error) throw error;
  },

  async clearChecked(companyId: string): Promise<void> {
    const { error } = await supabase
      .from("shopping_list_items")
      .delete()
      .eq("company_id", companyId)
      .eq("checked", true);
    if (error) throw error;
  },
};
