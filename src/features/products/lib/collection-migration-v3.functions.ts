import { createServerFn } from "@tanstack/react-start";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // We target the specific slug from the load logic: 'tg-style-catalogue'
    // The company_id was confirmed in previous turns: '78bfccca-f3a5-4110-9983-13e073f3ba77'
    const targetSlug = "tg-style-catalogue";
    const companyId = "78bfccca-f3a5-4110-9983-13e073f3ba77";

    // 1. Diagnostics: Try to find the collection using exact query from load logic
    const { data: col, error: colErr } = await supabaseAdmin
      .from("product_collections")
      .select("id, slug, name, company_id")
      .eq("slug", targetSlug)
      .maybeSingle();

    if (colErr) throw colErr;

    if (!col) {
      // If not found by slug, let's list all collections for THIS company
      const { data: allCols } = await supabaseAdmin
        .from("product_collections")
        .select("id, name, slug, company_id")
        .eq("company_id", companyId);

      return { 
          success: false, 
          message: `Coleção slug='${targetSlug}' não encontrada.`,
          availableForCompany: allCols,
          companyId: companyId
      };
    }

    const collectionId = col.id;

    // 2. Get ALL products for this company
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
          message: "Nenhum produto de Vestuário com canal 'catalog' encontrado.",
          totalProducts: allProducts?.length,
          categories: [...new Set((allProducts ?? []).map(p => (p as any).category?.name))]
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
    const toAssociate = productIds.filter(id => !existingIds.has(id));

    if (toAssociate.length === 0) {
      return { success: true, message: "Todos os produtos de Vestuário já estão associados.", count: 0 };
    }

    // 5. Get last position to append
    const { data: lastItem } = await supabaseAdmin
      .from("product_collection_items")
      .select("position")
      .eq("collection_id", collectionId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startPos = (lastItem?.position ?? 0) + 1;

    // 6. Insert associations
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
      message: `${toAssociate.length} produtos de Vestuário associados com sucesso.`,
      count: toAssociate.length,
      collection: col.name,
      associatedNames: vestuarioProducts.filter(p => toAssociate.includes(p.id)).map(p => p.name)
    };
  });
