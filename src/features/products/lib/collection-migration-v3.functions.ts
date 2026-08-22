import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    // 1. Diagnostics: List all companies without filtering to see what's there
    const { data: companies, error: compError } = await supabase
      .from("companies")
      .select("id, name");

    if (compError) throw compError;

    // 2. Diagnostics: List all collections without filtering
    const { data: cols, error: colError } = await supabase
      .from("product_collections")
      .select("id, name, slug, company_id");

    if (colError) throw colError;

    return { 
        success: true, 
        message: "Diagnostics Result",
        companies,
        collections: cols
    };
  });