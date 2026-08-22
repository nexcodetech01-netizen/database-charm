import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const associateVestuarioProductsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    // Check companies
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .limit(10);

    return { 
        success: false, 
        message: "Companies Diagnostic",
        companies: companies
    };
  });
