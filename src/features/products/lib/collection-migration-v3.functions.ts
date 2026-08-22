import { createServerFn } from "@tanstack/react-start";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const COLLECTION_SLUG = "tg-style-catalogue";
    const CATEGORY_NAME = "Vestuário";

    // 1. Find the collection
    const { data: collection, error: colError } = await supabaseAdmin
      .from("product_collections")
      .select("id, company_id")
      .eq("slug", COLLECTION_SLUG)
      .maybeSingle();

    if (colError) throw colError;
    if (!collection) return { success: false, message: `Coleção '${COLLECTION_SLUG}' não encontrada.` };

    // 2. Find the category
    const { data: category, error: catError } = await supabaseAdmin
      .from("product_categories")
      .select("id")
      .eq("company_id", collection.company_id)
      .eq("name", CATEGORY_NAME)
      .maybeSingle();

    if (catError) throw catError;
    if (!category) return { success: false, message: `Categoria '${CATEGORY_NAME}' não encontrada para esta empresa.` };

    // 3. Find active products in this category with 'catalog' channel
    const { data: prods, error: prodError } = await supabaseAdmin
      .from("products")
      .select("id, name, sales_channels")
      .eq("company_id", collection.company_id)
      .eq("category_id", category.id)
      .eq("status", "active")
      .gt("stock", 0);

    if (prodError) throw prodError;
    
    const catalogProds = (prods ?? []).filter(p => (p.sales_channels as string[])?.includes('catalog'));
    
    if (catalogProds.length === 0) {
        return { success: true, message: "Nenhum produto de Vestuário com estoque e canal 'catalog' encontrado.", count: 0 };
    }

    // 4. Check existing associations
    const { data: existing } = await supabaseAdmin
      .from("product_collection_items")
      .select("product_id")
      .eq("collection_id", collection.id);

    const existingIds = new Set(existing?.map(e => e.product_id) || []);
    const toAssociate = catalogProds.filter(p => !existingIds.has(p.id));

    if (toAssociate.length === 0) {
      return { success: true, message: "Todos os produtos de Vestuário elegíveis já estão no catálogo.", count: 0 };
    }

    // 5. Get position
    const { data: lastItem } = await supabaseAdmin
      .from("product_collection_items")
      .select("position")
      .eq("collection_id", collection.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startPos = (lastItem?.position ?? 0) + 1;

    // 6. Insert
    const newItems = toAssociate.map((p, index) => ({
      collection_id: collection.id,
      product_id: p.id,
      position: startPos + index
    }));

    const { error: insertError } = await supabaseAdmin
      .from("product_collection_items")
      .insert(newItems);

    if (insertError) throw insertError;

    return { 
      success: true, 
      message: `${toAssociate.length} produtos de Vestuário associados com sucesso.`,
      count: toAssociate.length,
      associatedNames: toAssociate.map(p => p.name)
    };
  });