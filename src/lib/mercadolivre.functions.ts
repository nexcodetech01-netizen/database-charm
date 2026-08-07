import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCompanyId } from "@/lib/company-resolver.server";

export const getMercadoLivreOrderLabel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mlOrderId: string }) => {
    const mlOrderId = String(input?.mlOrderId ?? "").trim();
    if (!mlOrderId) throw new Error("mlOrderId obrigatório.");
    return { mlOrderId };
  })
  .handler(async ({ data, context }) => {
    const { getOrderLabel } = await import("./mercadolivre.server");
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    
    console.log(`[ML_LABEL_REQUEST] order=${data.mlOrderId} company=${companyId}`);
    
    try {
      const result = await getOrderLabel(context.supabase, companyId, data.mlOrderId);
      return result;
    } catch (error) {
      console.error(`[ML_LABEL_ERROR] order=${data.mlOrderId}:`, error);
      throw error;
    }
  });
