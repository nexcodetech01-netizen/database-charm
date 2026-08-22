import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function run() {
  const { data: companies, error: ce } = await supabaseAdmin
    .from("companies")
    .select("id, name")
    .ilike("name", "%Tiele%");
  
  if (ce) {
    console.error("Error fetching companies:", ce);
    return;
  }
  
  console.log("Companies found:", companies);
  
  if (!companies || companies.length === 0) {
    console.error("Company not found");
    return;
  }
  
  const companyId = companies[0].id;
  
  // 1. Check if collection already exists
  const { data: existing } = await supabaseAdmin
    .from("product_collections")
    .select("id")
    .eq("company_id", companyId)
    .eq("slug", "tg-style-catalogue")
    .maybeSingle();
    
  if (existing) {
    console.log("Collection already exists:", existing.id);
  } else {
    // 2. Create collection
    const { data: collection, error: colErr } = await supabaseAdmin
      .from("product_collections")
      .insert({
        company_id: companyId,
        name: "Catálogo",
        slug: "tg-style-catalogue",
        status: "active",
        cta_mode: "whatsapp",
        show_price: true,
        show_installments: true,
        show_stock: true,
        show_brand: true
      })
      .select()
      .single();
      
    if (colErr) {
      console.error("Error creating collection:", colErr);
      return;
    }
    console.log("Collection created:", collection.id);
    
    // 3. Associate 1 product from Vestuário
    // First, find a product in Vestuário (Category ID: b3c32167-c99d-4174-b81a-853efbfc8582)
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, name")
      .eq("company_id", companyId)
      .eq("category_id", "b3c32167-c99d-4174-b81a-853efbfc8582")
      .limit(1);
      
    if (products && products.length > 0) {
      const productId = products[0].id;
      const { error: itemErr } = await supabaseAdmin
        .from("product_collection_items")
        .insert({
          collection_id: collection.id,
          product_id: productId,
          position: 1
        });
        
      if (itemErr) {
        console.error("Error associating product:", itemErr);
      } else {
        console.log("Product associated:", products[0].name);
      }
    } else {
      console.error("No products found in category Vestuário");
    }
  }
}

run();
