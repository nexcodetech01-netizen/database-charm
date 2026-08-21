import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit.server";

/**
 * Consulta pública de pontos de fidelidade — por telefone, sem login.
 * Mesmo padrão de segurança já usado em `shipments`/`product_reviews`:
 * busca feita no servidor, sem policy pública direta na tabela.
 */
export const getLoyaltyBalanceByPhone = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({
      slug: z.string(),
      phone: z.string().min(8),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const limited = checkRateLimit({ route: "loyalty:check-balance", max: 10, windowMs: 60_000 });
    if (!limited.ok) {
      return { found: false, error: "Muitas consultas seguidas. Tenta de novo em instantes." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve a empresa a partir do slug da coleção (mesmo caminho já
    // usado nas páginas do catálogo público) — o cliente só conhece o
    // link da loja, não o companyId.
    const { data: collection } = await supabaseAdmin
      .from("product_collections")
      .select("company_id")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!collection) {
      return { found: false as const };
    }

    const companyId = collection.company_id;
    const cleanPhone = data.phone.replace(/\D/g, "");

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, name")
      .eq("company_id", companyId)
      .or(`phone.eq.${cleanPhone},whatsapp.eq.${cleanPhone}`)
      .maybeSingle();

    if (!customer) {
      return { found: false as const };
    }

    const { data: account } = await supabaseAdmin
      .from("loyalty_accounts")
      .select("points_balance")
      .eq("customer_id", customer.id)
      .maybeSingle();

    const { data: settings } = await supabaseAdmin
      .from("loyalty_settings")
      .select("redemption_value_per_point, enabled")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!settings?.enabled) {
      return { found: false as const };
    }

    const points = account?.points_balance ?? 0;
    const valueInReais = points * (settings?.redemption_value_per_point ?? 0);

    return {
      found: true as const,
      customerName: customer.name,
      points,
      valueInReais,
    };
  });
