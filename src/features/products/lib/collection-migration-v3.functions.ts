import { createServerFn } from "@tanstack/react-start";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const companyId = "78bfccca-f3a5-4110-9983-13e073f3ba77";

    // 1. Find the correct collection ID for 'tg-style-catalogue' for this company
    const { data: collection, error: colError } = await supabaseAdmin
      .from("product_collections")
      .select("id, slug")
      .eq("company_id", companyId)
      .eq("slug", "tg-style-catalogue")
      .maybeSingle();

    if (colError) throw colError;
    if (!collection) {
      // Diagnostic: list collections for this company
      const { data: allCols } = await supabaseAdmin
        .from("product_collections")
        .select("id, name, slug")
        .eq("company_id", companyId);
      
      return { 
          success: false, 
          message: "Coleção 'tg-style-catalogue' não encontrada para esta empresa.",
          availableCollections: allCols
      };
    }

    const collectionId = collection.id;

    // 2. Get ALL products for this company bypassing RLS
    const { data: allProducts, error: fetchError } = await supabaseAdmin
      .from("products")
      .select("id, name, sales_channels, status, category_id, category:product_categories(id, name)")
      .eq("company_id", companyId);

    if (fetchError) throw fetchError;
    
    // 3. Filter products that are active, have 'catalog' in sales_channels, 
    // and belong to a category named 'Vestuário'
    const vestuarioProducts = (allProducts ?? []).filter(p => {
        const isPublic = p.status === 'active';
        // @ts-ignore
        const channels = (p.sales_channels as string[] | null);
        const hasCatalog = channels?.includes('catalog');
        
        // Normalize name for comparison
        // @ts-ignore
        const catName = (p.category as any)?.name?.trim();
        const isVestuario = catName === 'Vestuário' || catName === 'Vestuario' || catName === 'VESTUÁRIO';
        
        return isPublic && hasCatalog && isVestuario;
    });

    if (vestuarioProducts.length === 0) {
      return { 
          success: false, 
          message: "Nenhum produto de Vestuário com canal 'catalog' encontrado no contexto Admin.",
          totalProductsFound: allProducts?.length
      };
    }

    const productIds = vestuarioProducts.map(p => p.id);

    // 4. Check existing associations
    const { data: existing } = await supabaseAdmin
      .from("product_collection_items")
      .select("product_id")
      .eq("collection_id", collectionId)
      .in("product_id", productIds);

    const existingIds = new Set(existing?.map(e => e.product_id) || []);
    
    // 5. Filter only those not associated yet
    const toAssociate = productIds.filter(id => !existingIds.has(id));

    if (toAssociate.length === 0) {
      return { success: true, message: "Todos os produtos de Vestuário já estão associados.", count: 0 };
    }

    // 6. Get last position to append
    const { data: lastItem } = await supabaseAdmin
      .from("product_collection_items")
      .select("position")
      .eq("collection_id", collectionId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startPos = (lastItem?.position ?? 0) + 1;

    // 7. Insert associations
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
      message: `${toAssociate.length} produtos de Vestuário associados com sucesso (Admin).`,
      count: toAssociate.length,
      associatedNames: vestuarioProducts.filter(p => toAssociate.includes(p.id)).map(p => p.name)
    };
  });

