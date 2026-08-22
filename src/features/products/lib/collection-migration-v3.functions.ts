import { createServerFn } from "@tanstack/react-start";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const companyId = "78bfccca-f3a5-4110-9983-13e073f3ba77";
    const targetSlug = "tg-style-catalogue";

    // 1. Diagnostics: List all collections for THIS company
    const { data: cols, error: colError } = await supabaseAdmin
      .from("product_collections")
      .select("id, name, slug")
      .eq("company_id", companyId);

    if (colError) throw colError;

    // 2. Find the collection
    const targetCol = cols?.find(c => c.slug === targetSlug);

    if (!targetCol) {
      return { 
          success: false, 
          message: `Coleção '${targetSlug}' não encontrada para empresa ${companyId}.`,
          foundCollections: cols
      };
    }

    const collectionId = targetCol.id;

    // 3. IDs of products identified in audit
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

    // 4. Check existing items
    const { data: existing } = await supabaseAdmin
      .from("product_collection_items")
      .select("product_id")
      .eq("collection_id", collectionId)
      .in("product_id", auditIds);

    const existingIds = new Set(existing?.map(e => e.product_id) || []);
    const toAssociate = auditIds.filter(id => !existingIds.has(id));

    if (toAssociate.length === 0) {
      return { success: true, message: "Todos os produtos auditados já estão associados.", count: 0 };
    }

    // 5. Get position
    const { data: lastItem } = await supabaseAdmin
      .from("product_collection_items")
      .select("position")
      .eq("collection_id", collectionId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startPos = (lastItem?.position ?? 0) + 1;

    // 6. Final Association
    const newItems = toAssociate.map((productId, index) => ({
      collection_id: collectionId,
      product_id: productId,
      position: startPos + index
    }));

    const { error: insertError } = await supabaseAdmin
      .from("product_collection_items")
      .insert(newItems);

    if (insertError) throw insertError;

    return { 
      success: true, 
      message: `${toAssociate.length} produtos de Vestuário associados via auditoria Admin (Final).`,
      count: toAssociate.length,
      collection: targetCol.name
    };
  });
