import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const searchInputSchema = z.object({
  companyId: z.string().uuid(),
  term: z.string(),
  limit: z.number().optional().default(50),
});

/**
 * RPC bridge to search_products_unaccent.
 * Use this to ignore accents on both search term and database content.
 */
export const searchProductsUnaccent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => searchInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: products, error } = await context.supabase.rpc("search_products_unaccent", {
      search_term: data.term,
      company_id_param: data.companyId,
      limit_param: data.limit,
    });

    if (error) {
      console.error("[searchProductsUnaccent] Error:", error);
      throw error;
    }

    return products;
  });
