import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const collectionId = "c1266d6d-66e0-4f51-872f-574f7678d43d";
    const companyId = "78bfccca-f3a5-4110-9983-13e073f3ba77";

    // 1. Get ALL products for this company
    const { data: allProducts, error: fetchError } = await supabase
      .from("products")
      .select("id, name, sales_channels, status, category_id")
      .eq("company_id", companyId);

    if (fetchError) throw fetchError;

    // Use specific IDs mentioned in the audit
    const auditIds = [
      "10d8d05e-5b12-4211-96f3-69ed3c31405a",
      "af744aca-fcf3-487e-97f2-11a2f960f588",
      "0e380f81-f2f2-4917-8e12-c2883a48e895",
      "72f32fe4-22b0-4b21-87a4-a9572c6edc88",
      "29e01a84-7a31-4043-a621-3e4b706c6c73",
      "1b51d410-d85c-44d3-827d-965a9ef03901",
      "38557bcb-8e3d-4c57-827a-e45f187a0279",
      "3bf2ae3f-3665-4f46-9f87-a2f026048d90",
      "d1614022-75d3-4672-8700-0e104ea26330",
      "843a63f0-4f49-4171-884b-01121d154625"
    ];

    const vestuarioProducts = (allProducts ?? []).filter(p => auditIds.includes(p.id));

    if (vestuarioProducts.length === 0) {
      return { 
          success: false, 
          message: "Nenhum dos IDs de Vestuário auditados foi encontrado no banco.",
          foundIdsCount: (allProducts ?? []).length
      };
    }

    const productIds = vestuarioProducts.map(p => p.id);

    // Check existing associations
    const { data: existing } = await supabase
      .from("product_collection_items")
      .select("product_id")
      .eq("collection_id", collectionId)
      .in("product_id", productIds);

    const existingIds = new Set(existing?.map(e => e.product_id) || []);
    const toAssociate = productIds.filter(id => !existingIds.has(id));

    if (toAssociate.length === 0) {
      return { success: true, message: "Todos os produtos de Vestuário auditados já estão associados.", count: 0 };
    }

    // Get position
    const { data: lastItem } = await supabase
      .from("product_collection_items")
      .select("position")
      .eq("collection_id", collectionId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startPos = (lastItem?.position ?? 0) + 1;

    // Insert
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
      message: `${toAssociate.length} produtos de Vestuário associados via auditoria.`,
      count: toAssociate.length,
      associatedNames: vestuarioProducts.filter(p => toAssociate.includes(p.id)).map(p => p.name)
    };
  });
