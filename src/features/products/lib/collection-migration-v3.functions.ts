import { createServerFn } from "@tanstack/react-start";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // We already know company_id = 78bfccca-f3a5-4110-9983-13e073f3ba77
    // Let's list ALL tables to see if we have the right table names
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from("pg_catalog.pg_tables")
      .select("tablename")
      .eq("schemaname", "public");

    if (tablesError) {
        // Fallback: Just try a direct query on product_collections without filtering to see IF it has anything
        const { data: allCollections } = await supabaseAdmin.from("product_collections").select("*").limit(5);
        const { data: allCompanies } = await supabaseAdmin.from("companies").select("id, name").limit(5);
        
        return { 
            success: false, 
            message: "Table diagnostic failed", 
            error: tablesError.message,
            allCollectionsSample: allCollections,
            allCompaniesSample: allCompanies
        };
    }

    return { 
        success: false, 
        message: "Public Tables Diagnostic",
        tables: tables?.map(t => t.tablename)
    };
  });
