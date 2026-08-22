import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const collectionId = "c1266d6d-66e0-4f51-872f-574f7678d43d";
    const companyId = "78bfccca-f3a5-4110-9983-13e073f3ba77";

    // 1. Get Vestuario products that have 'catalog' in sales_channels
    const { data: products, error: fetchError } = await supabase
      .from("products")
      .select("id, name, category")
      .eq("company_id", companyId)
      .eq("status", "active")
      .eq("category", "Vestuário")
      .contains("sales_channels", ["catalog"]);

    if (fetchError) throw fetchError;
    if (!products || products.length === 0) {
      return { success: false, message: "Nenhum produto de Vestuário com canal 'catalog' encontrado." };
    }

    const productIds = products.map(p => p.id);

    // 2. Check existing associations to avoid duplicates
    const { data: existing, error: existingError } = await supabase
      .from("product_collection_items")
      .select("product_id")
      .eq("collection_id", collectionId)
      .in("product_id", productIds);

    if (existingError) throw existingError;
    const existingIds = new Set(existing?.map(e => e.product_id) || []);
    
    // 3. Filter only those not associated yet
    const toAssociate = productIds.filter(id => !existingIds.has(id));

    if (toAssociate.length === 0) {
      return { success: true, message: "Todos os produtos de Vestuário já estão associados.", count: 0 };
    }

    // 4. Get last position to append
    const { data: lastItem } = await supabase
      .from("product_collection_items")
      .select("position")
      .eq("collection_id", collectionId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startPos = (lastItem?.position ?? 0) + 1;

    // 5. Insert associations
    const newItems = toAssociate.map((productId, index) => ({
      collection_id: collectionId,
      product_id: productId,
      position: startPos + index
    }));

    const { error: insertError } = await supabase
      .from("product_collection_items")
      .insert(newItems);

    if (insertError) throw insertError;

    return { 
      success: true, 
      message: `${toAssociate.length} produtos de Vestuário associados com sucesso.`,
      count: toAssociate.length,
      associatedNames: products.filter(p => toAssociate.includes(p.id)).map(p => p.name)
    };
  });
