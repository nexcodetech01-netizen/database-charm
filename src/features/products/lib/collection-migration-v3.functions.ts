import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    // 1. Diagnostics: List all companies
    const { data: companies, error: compError } = await supabase
      .from("companies")
      .select("id, name");

    if (compError) throw compError;

    // 2. Find Tiele's company
    const tiele = companies?.find(c => c.name.includes('Tiele'));
    
    if (!tiele) {
        return { success: false, message: "Empresa Tiele não encontrada", companies };
    }

    const companyId = tiele.id;

    // 3. List ALL collections for this company
    const { data: cols, error: colError } = await supabase
      .from("product_collections")
      .select("id, name, slug")
      .eq("company_id", companyId);

    if (colError) throw colError;

    return { 
        success: false, 
        message: "Diagnostics Result",
        companyName: tiele.name,
        companyId: companyId,
        collectionsFound: cols
    };
  });
