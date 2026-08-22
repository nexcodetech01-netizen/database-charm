import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    // 1. Diagnostics: List all collections for company '78bfccca-f3a5-4110-9983-13e073f3ba77' using PUBLIC client
    const { data: cols, error: colError } = await supabase
      .from("product_collections")
      .select("id, name, slug")
      .eq("company_id", "78bfccca-f3a5-4110-9983-13e073f3ba77");

    if (colError) throw colError;

    return { 
        success: false, 
        message: "Debug: Public Collection List",
        collections: cols
    };
  });
