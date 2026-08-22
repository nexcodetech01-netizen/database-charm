import { createServerFn } from "@tanstack/react-start";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Diagnostics: List all collections in the entire database
    const { data: cols, error: colError } = await supabaseAdmin
      .from("product_collections")
      .select("id, name, slug, company_id");

    if (colError) throw colError;

    return { 
        success: false, 
        message: "Debug: Global Collection List",
        collections: cols
    };
  });
