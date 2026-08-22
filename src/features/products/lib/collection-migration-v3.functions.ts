import { createServerFn } from "@tanstack/react-start";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Final Attempt: Use raw SQL to list collections and bypass any client-side filtering
    const { data: cols, error: colError } = await supabaseAdmin.rpc('get_collections_debug', {});

    if (colError) {
        // If RPC doesn't exist (likely), just try to select ID from collections where slug matches
        const { data: direct, error: directError } = await supabaseAdmin
            .from("product_collections")
            .select("id, slug, company_id")
            .eq("slug", "tg-style-catalogue");

        return { 
            success: false, 
            message: "Direct Slug Lookup",
            directData: direct,
            directError: directError?.message
        };
    }

    return { 
        success: false, 
        message: "RPC Diagnostic",
        cols: cols
    };
  });
