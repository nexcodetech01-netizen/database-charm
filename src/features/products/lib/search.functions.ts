import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  .inputValidator((data) => searchInputSchema.parse(data))
  .handler(async ({ data }) => {
    // BUG ENCONTRADO E CORRIGIDO (2026-08-31): mesmo padrão de outras
    // funções corrigidas hoje — usava o cliente genérico do navegador
    // rodando do servidor, sem sessão nenhuma, e sem nenhuma
    // verificação de que quem chamou pertence ao `companyId` recebido
    // (vem direto do cliente). Trocado pro cliente administrativo.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: products, error } = await supabaseAdmin.rpc("search_products_unaccent", {
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
