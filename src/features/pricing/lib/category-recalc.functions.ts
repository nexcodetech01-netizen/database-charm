/**
 * Server functions — Recálculo de preços por CATEGORIA (opt-in)
 * =============================================================
 * A política de categoria é aplicada automaticamente a produtos NOVOS.
 * Produtos existentes NUNCA são alterados de forma automática: o usuário
 * pede a prévia (`previewCategoryRecalc`), revisa e só então confirma a
 * aplicação (`applyCategoryRecalc`) para os produtos que escolher.
 *
 * MOTOR ÚNICO — todo preço vem de `computeSuggestedPrice`.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerPermission } from "@/features/rbac/guards/server-guards";
import { computeSuggestedPrice } from "@/features/pricing/official";
import { fetchPricingInputs } from "@/features/pricing/data/pricing-inputs";

export type RecalcScope = "missing_price" | "all";

export interface RecalcCandidate {
  readonly id: string;
  readonly name: string;
  readonly sku: string | null;
  readonly currentPrice: number;
  readonly suggestedPrice: number;
  readonly cost: number;
  readonly marginSource: string;
}

export interface RecalcPreviewDTO {
  readonly categoryId: string;
  readonly targetMarginPct: number;
  readonly marginSource: string;
  readonly total: number;
  readonly candidates: readonly RecalcCandidate[];
  readonly skippedWithoutCost: number;
}

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export const previewCategoryRecalc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string; categoryId: string; scope?: RecalcScope }) => {
    if (!input?.companyId) throw new Error("companyId é obrigatório");
    if (!input?.categoryId) throw new Error("categoryId é obrigatório");
    return input;
  })
  .handler(async ({ data, context }): Promise<RecalcPreviewDTO> => {
    const scope: RecalcScope = data.scope ?? "missing_price";
    const inputs = await fetchPricingInputs(context.supabase, data.companyId, data.categoryId);

    const { data: rows, error } = await context.supabase
      .from("products")
      .select("id, name, sku, price, cost, freight, packaging, insurance, other_costs")
      .eq("company_id", data.companyId)
      .eq("category_id", data.categoryId)
      .order("name")
      .limit(1000);
    if (error) throw error;

    let skippedWithoutCost = 0;
    const candidates: RecalcCandidate[] = [];

    for (const p of rows ?? []) {
      const cost = n(p.cost);
      const currentPrice = n(p.price);
      if (scope === "missing_price" && currentPrice > 0) continue;
      if (cost <= 0) {
        skippedWithoutCost += 1;
        continue;
      }
      const official = computeSuggestedPrice({
        companyId: data.companyId,
        productId: p.id,
        categoryId: data.categoryId,
        costs: {
          acquisition: cost,
          freight: n(p.freight) || inputs.costDefaults.freight,
          packaging: n(p.packaging) || inputs.costDefaults.packaging,
          insurance: n(p.insurance) || inputs.costDefaults.insurance,
          otherCosts: n(p.other_costs) || inputs.costDefaults.otherCosts,
        },
        margins: inputs.margins,
        taxPct: inputs.taxPct,
        feeTable: inputs.feeTable,
        module: "pricing.category-recalc",
      });
      const suggested = Math.round(official.targetPrice * 100) / 100;
      if (!(suggested > 0)) continue;
      candidates.push({
        id: p.id,
        name: p.name,
        sku: p.sku ?? null,
        currentPrice,
        suggestedPrice: suggested,
        cost,
        marginSource: inputs.marginSource,
      });
    }

    return {
      categoryId: data.categoryId,
      targetMarginPct: inputs.margins.targetPct,
      marginSource: inputs.marginSource,
      total: candidates.length,
      candidates,
      skippedWithoutCost,
    };
  });

export interface RecalcApplyResultDTO {
  readonly updated: number;
  readonly productIds: readonly string[];
}

export const applyCategoryRecalc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string; items: { productId: string; price: number }[] }) => {
    if (!input?.companyId) throw new Error("companyId é obrigatório");
    if (!Array.isArray(input?.items) || input.items.length === 0) {
      throw new Error("Nenhum produto selecionado para recálculo");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<RecalcApplyResultDTO> => {
    await requireServerPermission(context, "products.update", {
      companyId: data.companyId,
      action: "pricing.category_recalc.apply",
      module: "pricing",
    });

    const updated: string[] = [];
    for (const item of data.items) {
      const price = Math.round(Number(item.price) * 100) / 100;
      if (!item.productId || !(price > 0)) continue;
      const { error } = await context.supabase
        .from("products")
        .update({ price })
        .eq("id", item.productId)
        .eq("company_id", data.companyId);
      if (error) throw error;
      updated.push(item.productId);
    }

    return { updated: updated.length, productIds: updated };
  });
