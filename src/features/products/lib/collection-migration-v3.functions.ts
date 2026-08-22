import { createServerFn } from "@tanstack/react-start";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Check if the table exists by trying a count
    const { count, error } = await supabaseAdmin
      .from("product_collections")
      .select("*", { count: 'exact', head: true });

    return { 
        success: false, 
        message: "Collection Count Diagnostic",
        count: count,
        error: error?.message
    };
  });
