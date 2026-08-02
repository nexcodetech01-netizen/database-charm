/**
 * Referências de mercado (consultivo da Bella) — acesso a dados.
 * A leitura é feita pelo cliente autenticado (RLS): linhas globais
 * (`company_id IS NULL`) + linhas da própria empresa.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MarketReference } from "../official/market-reference";

interface Row {
  company_id: string | null;
  category_key: string;
  label: string;
  conservative_pct: number | string;
  common_pct: number | string;
  premium_pct: number | string;
  source_note: string | null;
}

const toRef = (r: Row): MarketReference => ({
  categoryKey: r.category_key,
  label: r.label,
  conservativePct: Number(r.conservative_pct),
  commonPct: Number(r.common_pct),
  premiumPct: Number(r.premium_pct),
  sourceNote: r.source_note,
  companyScoped: r.company_id != null,
});

export const listMarketReferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) => input)
  .handler(async ({ data, context }): Promise<MarketReference[]> => {
    const { data: rows, error } = await context.supabase
      .from("pricing_market_references")
      .select(
        "company_id, category_key, label, conservative_pct, common_pct, premium_pct, source_note",
      )
      .or(`company_id.is.null,company_id.eq.${data.companyId}`);
    if (error) return [];
    return ((rows ?? []) as Row[]).map(toRef);
  });

/**
 * Grava/atualiza a referência de mercado DA EMPRESA para uma categoria.
 * Catálogo configurável — separado da política comercial. Nunca toca em
 * produtos, preços ou nas margens da política.
 */
export const upsertCompanyMarketReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      companyId: string;
      categoryKey: string;
      label: string;
      conservativePct: number;
      commonPct: number;
      premiumPct: number;
      sourceNote?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await context.supabase.from("pricing_market_references").upsert(
      {
        company_id: data.companyId,
        category_key: data.categoryKey,
        label: data.label,
        conservative_pct: data.conservativePct,
        common_pct: data.commonPct,
        premium_pct: data.premiumPct,
        source_note: data.sourceNote ?? null,
      },
      { onConflict: "company_id,category_key" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
