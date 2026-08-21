import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit.server";

/**
 * Avaliações de produto — feature nova (2026-08-21).
 *
 * `submitProductReview`: pública, sem login — qualquer visitante do
 * catálogo pode enviar. Entra sempre como "pending" (moderação
 * manual antes de aparecer). Limite de taxa pra evitar spam.
 *
 * `getApprovedReviews`: pública — busca só as avaliações já
 * aprovadas de um produto, com a média calculada.
 */

export const submitProductReview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      productId: z.string().uuid(),
      companyId: z.string().uuid(),
      customerName: z.string().trim().min(2, "Nome muito curto").max(80),
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(1000).optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    // 5 avaliações por IP a cada 10 minutos — suficiente pra uso
    // legítimo, baixo o bastante pra dificultar spam automatizado.
    const limited = checkRateLimit({ route: "reviews:submit", max: 5, windowMs: 10 * 60_000 });
    if (!limited.ok) {
      return { success: false, error: "Muitas avaliações enviadas. Tenta de novo mais tarde." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Confirma que o produto realmente pertence à empresa informada —
    // evita que alguém envie avaliação pra um product_id de outra loja
    // usando o company_id errado de propósito.
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("id")
      .eq("id", data.productId)
      .eq("company_id", data.companyId)
      .maybeSingle();

    if (!product) {
      return { success: false, error: "Produto não encontrado." };
    }

    const { error } = await supabaseAdmin.from("product_reviews").insert({
      company_id: data.companyId,
      product_id: data.productId,
      customer_name: data.customerName,
      rating: data.rating,
      comment: data.comment || null,
      status: "pending",
    });

    if (error) {
      console.error("[submitProductReview] Erro:", error);
      return { success: false, error: "Não foi possível enviar a avaliação. Tenta de novo." };
    }

    return { success: true };
  });

export const getApprovedReviews = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: reviews, error } = await supabaseAdmin
      .from("product_reviews")
      .select("id, customer_name, rating, comment, created_at")
      .eq("product_id", data.productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !reviews) {
      console.error("[getApprovedReviews] Erro:", error);
      return { reviews: [], average: null, count: 0 };
    }

    const count = reviews.length;
    const average = count > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : null;

    return { reviews, average, count };
  });
