import { createServerFn } from "@tanstack/react-start";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Get ALL products for this company bypassing RLS
    // We already know company_id = 78bfccca-f3a5-4110-9983-13e073f3ba77
    const { data: allProducts, error: fetchError } = await supabaseAdmin
      .from("products")
      .select("id, name, sales_channels, status, category_id, category:product_categories(id, name)")
      .eq("company_id", "78bfccca-f3a5-4110-9983-13e073f3ba77");

    if (fetchError) throw fetchError;

    // 2. Look for existing collection associations to find the collection ID
    const { data: allItems, error: itemsError } = await supabaseAdmin
      .from("product_collection_items")
      .select("collection_id, product_id")
      .limit(100);

    if (itemsError) throw itemsError;

    return { 
        success: false, 
        message: "Diagnostics V4",
        productCount: allProducts?.length,
        distinctCollectionsInItems: [...new Set(allItems?.map(i => i.collection_id))],
        sampleItems: allItems?.slice(0, 5)
    };
  });
