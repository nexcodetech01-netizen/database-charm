import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const collectionId = "c1266d6d-66e0-4f51-872f-574f7678d43d";
    const companyId = "78bfccca-f3a5-4110-9983-13e073f3ba77";

    // 1. Get ALL products for this company
    const { data: allProducts, error: fetchError } = await supabase
      .from("products")
      .select("id, name, sales_channels, status, category_id, category:product_categories(id, name)")
      .eq("company_id", companyId);

    if (fetchError) throw fetchError;
    
    // 2. Filter products that are active and have 'catalog' in sales_channels
    const eligibleProducts = (allProducts ?? []).filter(p => {
        const isPublic = p.status === 'active';
        // @ts-ignore
        const hasCatalog = (p.sales_channels as string[] | null)?.includes('catalog');
        return isPublic && hasCatalog;
    });

    // 3. Narrow down to 'Vestuário' products
    // Since previous filters failed, let's identify them by name or category name
    const vestuarioProducts = eligibleProducts.filter(p => {
        // @ts-ignore
        const catName = (p.category as any)?.name?.trim();
        const isVestuario = catName === 'Vestuário' || catName === 'Vestuario' || catName === 'VESTUÁRIO' || 
                           p.name.toLowerCase().includes('camiseta') || p.name.toLowerCase().includes('calça') || 
                           p.name.toLowerCase().includes('vestido');
        
        return isVestuario;
    });

    if (vestuarioProducts.length === 0) {
      const categories = [...new Set((allProducts ?? []).map(p => (p as any).category?.name))];
      return { 
          success: false, 
          message: "Nenhum produto de Vestuário com canal 'catalog' encontrado.",
          availableCategories: categories,
          totalProductsFound: allProducts?.length,
          eligibleCount: eligibleProducts.length
      };
    }

    const productIds = vestuarioProducts.map(p => p.id);

    // 4. Check existing associations
    const { data: existing, error: existingError } = await supabase
      .from("product_collection_items")
      .select("product_id")
      .eq("collection_id", collectionId)
      .in("product_id", productIds);

    if (existingError) throw existingError;
    const existingIds = new Set(existing?.map(e => e.product_id) || []);
    
    // 5. Filter only those not associated yet
    const toAssociate = productIds.filter(id => !existingIds.has(id));

    if (toAssociate.length === 0) {
      return { success: true, message: "Todos os produtos de Vestuário já estão associados.", count: 0 };
    }

    // 6. Get last position to append
    const { data: lastItem } = await supabase
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

    const { error: insertError } = await supabase
      .from("product_collection_items")
      .insert(newItems);

    if (insertError) throw insertError;

    return { 
      success: true, 
      message: `${toAssociate.length} produtos de Vestuário associados com sucesso.`,
      count: toAssociate.length,
      associatedNames: vestuarioProducts.filter(p => toAssociate.includes(p.id)).map(p => p.name)
    };
  });




