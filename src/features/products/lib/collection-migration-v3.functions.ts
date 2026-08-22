import { createServerFn } from "@tanstack/react-start";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Diagnostics: List all companies
    const { data: companies, error: compError } = await supabaseAdmin
      .from("companies")
      .select("id, name");

    if (compError) throw compError;

    // 2. Diagnostics: List all collections
    const { data: cols, error: colError } = await supabaseAdmin
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