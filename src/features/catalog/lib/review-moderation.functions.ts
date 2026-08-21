import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Moderação de avaliações — uso interno, autenticado. `listReviews`
 * traz todas (qualquer status) da empresa logada, pra tela de gestão.
 * `moderateReview` aprova ou rejeita uma avaliação específica.
 */

export const listReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      companyId: z.string().uuid(),
      status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let query = supabase
      .from("product_reviews")
      .select("id, product_id, customer_name, rating, comment, status, created_at, products(name)")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false });

    if (data.status !== "all") {
      query = query.eq("status", data.status);
    }

    const { data: reviews, error } = await query;
    if (error) {
      console.error("[listReviews] Erro:", error);
      return [];
    }
    return reviews;
  });

export const moderateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      reviewId: z.string().uuid(),
      companyId: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("product_reviews")
      .update({ status: data.decision, reviewed_at: new Date().toISOString() })
      .eq("id", data.reviewId)
      .eq("company_id", data.companyId);

    if (error) {
      console.error("[moderateReview] Erro:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  });
