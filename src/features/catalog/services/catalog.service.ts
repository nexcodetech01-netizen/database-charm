import { supabase } from "@/integrations/supabase/client";
import type {
  Collection,
  CollectionInsert,
  CollectionUpdate,
  CollectionWithCount,
} from "../types";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

export const catalogService = {
  slugify,

  async ensureUniqueSlug(companyId: string, base: string, ignoreId?: string) {
    let candidate = base || "colecao";
    let n = 1;
    while (true) {
      let q = supabase
        .from("product_collections")
        .select("id")
        .eq("company_id", companyId)
        .eq("slug", candidate);
      if (ignoreId) q = q.neq("id", ignoreId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      if (!data) return candidate;
      n += 1;
      candidate = `${base}-${n}`;
    }
  },

  async list(companyId: string): Promise<CollectionWithCount[]> {
    const { data, error } = await supabase
      .from("product_collections")
      .select("*, items:product_collection_items(id)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => {
      const { items, ...rest } = row as Collection & {
        items: { id: string }[] | null;
      };
      return { ...rest, product_count: items?.length ?? 0 };
    });
  },

  async get(id: string) {
    const { data, error } = await supabase
      .from("product_collections")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(input: Omit<CollectionInsert, "slug"> & { slug?: string }) {
    const base = slugify(input.slug || input.name);
    const slug = await this.ensureUniqueSlug(input.company_id, base);
    const { data, error } = await supabase
      .from("product_collections")
      .insert({ ...input, slug })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(
    id: string,
    companyId: string,
    patch: CollectionUpdate,
    opts?: { rename?: boolean },
  ) {
    const clean: CollectionUpdate = { ...patch };
    if (opts?.rename && patch.name) {
      clean.slug = await this.ensureUniqueSlug(
        companyId,
        slugify(patch.name),
        id,
      );
    }
    const { data, error } = await supabase
      .from("product_collections")
      .update(clean)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string) {
    const { error } = await supabase
      .from("product_collections")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async listItems(collectionId: string) {
    const { data, error } = await supabase
      .from("product_collection_items")
      .select("id, product_id, position, product:products(*)")
      .eq("collection_id", collectionId)
      .order("position");
    if (error) throw error;
    return data ?? [];
  },

  async addProducts(collectionId: string, productIds: string[]) {
    if (productIds.length === 0) return;
    const { data: existing } = await supabase
      .from("product_collection_items")
      .select("product_id, position")
      .eq("collection_id", collectionId);
    const seen = new Set((existing ?? []).map((e) => e.product_id));
    const nextPos =
      (existing ?? []).reduce((m, e) => Math.max(m, e.position ?? 0), 0) + 1;
    const rows = productIds
      .filter((id) => !seen.has(id))
      .map((product_id, idx) => ({
        collection_id: collectionId,
        product_id,
        position: nextPos + idx,
      }));
    if (rows.length === 0) return;
    const { error } = await supabase
      .from("product_collection_items")
      .insert(rows);
    if (error) throw error;
  },

  async removeItem(itemId: string) {
    const { error } = await supabase
      .from("product_collection_items")
      .delete()
      .eq("id", itemId);
    if (error) throw error;
  },

  async countUncataloged(companyId: string) {
    const { data: prods, error: e1 } = await supabase
      .from("products")
      .select("id")
      .eq("company_id", companyId)
      .eq("status", "active");
    if (e1) throw e1;
    const productIds = (prods ?? []).map((p) => p.id);
    if (productIds.length === 0) return 0;
    const { data: items, error: e2 } = await supabase
      .from("product_collection_items")
      .select("product_id, collection:product_collections!inner(company_id)")
      .eq("collection.company_id", companyId);
    if (e2) throw e2;
    const inCollection = new Set(
      (items ?? []).map((it: { product_id: string }) => it.product_id),
    );
    return productIds.filter((id) => !inCollection.has(id)).length;
  },
};
