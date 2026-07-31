/**
 * Server functions — Recalcular Preços (bulk)
 * ============================================
 * Lista TODOS os produtos com preço atual vs preço calculado pelo
 * Pricing Engine (mesma cadeia canônica do resto do sistema).
 *
 * REGRAS:
 *   - Zero cálculo aqui — usa defaultResolver.build() + defaultEngine.compute()
 *     (mesma composição de custo canônica: cost + freight + packaging +
 *      insurance + others, derivada dentro do engine).
 *   - Não persiste nada. A aplicação em lote no cliente reusa
 *     `applyProductSuggestedPrice` (que já atualiza apenas products.price
 *     e registra auditoria via RegisterPricingDecision).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PolicyLayerName } from "@/features/pricing/resolver/types";

export interface RecalculationItemDTO {
  readonly productId: string;
  readonly name: string;
  readonly sku: string | null;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly currentPriceCents: number;
  readonly recommendedPriceCents: number;
  readonly differenceCents: number;
  readonly differencePct: number;
  readonly currentMarginPct: number;
  readonly targetMarginPct: number;
  readonly costTotalCents: number;
  readonly originLayer: PolicyLayerName;
  readonly originLabel: string;
  readonly hasOwnPolicy: boolean;
  readonly belowMinMargin: boolean;
  readonly hasCost: boolean;
  readonly skipped: boolean;
  readonly skipReason: "missing_cost" | "no_company_policy" | null;
}

export interface RecalculationListDTO {
  readonly companyId: string;
  readonly computedAt: string;
  readonly totalProducts: number;
  readonly totalDivergent: number;
  readonly totalSkipped: number;
  readonly currentSumCents: number;
  readonly recommendedSumCents: number;
  readonly items: readonly RecalculationItemDTO[];
}

const ORIGIN_LABEL: Record<PolicyLayerName, string> = {
  product: "Produto",
  category: "Categoria",
  company: "Empresa",
  context: "Contexto",
  system: "Sistema",
};

const toN = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const MAX_PRODUCTS = 2000;

export type RecalculationMarginKind = "min" | "ideal" | "premium";

export const getPriceRecalculationList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { companyId: string; marginTarget?: RecalculationMarginKind }) => {
      if (!input?.companyId) throw new Error("companyId é obrigatório");
      const marginTarget: RecalculationMarginKind =
        input.marginTarget === "min" ||
        input.marginTarget === "premium" ||
        input.marginTarget === "ideal"
          ? input.marginTarget
          : "ideal";
      return { companyId: input.companyId, marginTarget };
    },
  )
  .handler(async ({ data, context }): Promise<RecalculationListDTO> => {
    const [{ createSupabaseRepositories }, application, engineMod, costDefaultsMod] =
      await Promise.all([
        import("@/features/pricing/persistence/supabase.server"),
        import("@/features/pricing/application"),
        import("@/features/pricing/engine"),
        import("@/features/pricing/lib/company-cost-defaults"),
      ]);

    const repos = createSupabaseRepositories(context.supabase);
    const clock = application.systemClock;
    const ids = application.createIdGenerator();
    const nowIso = clock.nowIso();
    const companyCostDefaults = await costDefaultsMod.fetchCompanyCostDefaults(
      context.supabase,
      data.companyId,
    );

    const [companyEnt, categoryPolicies, productPolicies, categoriesRes, productsRes] =
      await Promise.all([
        repos.companyPolicies.findByCompany(data.companyId),
        repos.categoryPolicies.listByCompany(data.companyId),
        repos.productPolicies.listByCompany(data.companyId),
        context.supabase
          .from("product_categories")
          .select("id, name")
          .eq("company_id", data.companyId),
        context.supabase
          .from("products")
          .select(
            "id, name, sku, category_id, cost, freight, packaging, insurance, other_costs, price, updated_at",
          )
          .eq("company_id", data.companyId)
          .order("name")
          .limit(MAX_PRODUCTS),
      ]);

    if (categoriesRes.error) throw categoriesRes.error;
    if (productsRes.error) throw productsRes.error;

    const categoryNameById = new Map(
      (categoriesRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]),
    );
    const categoryPolicyByCategoryId = new Map(
      categoryPolicies.map((p) => [p.entity.categoryId, p]),
    );
    const productPolicyByProductId = new Map(
      productPolicies.map((p) => [p.entity.productId, p]),
    );

    const products = (productsRes.data ?? []) as Array<{
      id: string;
      name: string;
      sku: string | null;
      category_id: string | null;
      cost: number | string | null;
      freight: number | string | null;
      packaging: number | string | null;
      insurance: number | string | null;
      other_costs: number | string | null;
      price: number | string | null;
      updated_at: string | null;
    }>;

    const items: RecalculationItemDTO[] = [];
    let currentSumCents = 0;
    let recommendedSumCents = 0;
    let totalDivergent = 0;
    let totalSkipped = 0;

    for (const p of products) {
      const currentPriceCents = Math.round(toN(p.price) * 100);
      const categoryName = p.category_id ? categoryNameById.get(p.category_id) ?? null : null;

      if (!companyEnt) {
        totalSkipped += 1;
        items.push({
          productId: p.id,
          name: p.name,
          sku: p.sku ?? null,
          categoryId: p.category_id,
          categoryName,
          currentPriceCents,
          recommendedPriceCents: 0,
          differenceCents: 0,
          differencePct: 0,
          currentMarginPct: 0,
          targetMarginPct: 0,
          costTotalCents: 0,
          originLayer: "system",
          originLabel: ORIGIN_LABEL.system,
          hasOwnPolicy: false,
          belowMinMargin: false,
          hasCost: false,
          skipped: true,
          skipReason: "no_company_policy",
        });
        continue;
      }

      const cost = toN(p.cost);
      const mergedCosts = costDefaultsMod.mergeProductOperationalCosts(p, companyCostDefaults);
      const freight = mergedCosts.freight;
      const packaging = mergedCosts.packaging;
      const insurance = mergedCosts.insurance;
      const others = mergedCosts.otherCosts;

      const costComposition = engineMod.composeCostComposition({
        acquisitionCostCents: Math.round(cost * 100),
        freightCents: Math.round(freight * 100),
        packagingCents: Math.round(packaging * 100),
        insuranceCents: Math.round(insurance * 100),
        otherExpensesCents: Math.round(others * 100),
        computedAt: p.updated_at ?? nowIso,
        origin: "inventory",
      });

      if (costComposition.perUnitCostCents <= 0) {
        totalSkipped += 1;
        items.push({
          productId: p.id,
          name: p.name,
          sku: p.sku ?? null,
          categoryId: p.category_id,
          categoryName,
          currentPriceCents,
          recommendedPriceCents: 0,
          differenceCents: 0,
          differencePct: 0,
          currentMarginPct: 0,
          targetMarginPct: 0,
          costTotalCents: 0,
          originLayer: "system",
          originLabel: ORIGIN_LABEL.system,
          hasOwnPolicy: !!productPolicyByProductId.get(p.id),
          belowMinMargin: false,
          hasCost: false,
          skipped: true,
          skipReason: "missing_cost",
        });
        continue;
      }

      const categoryEnt = p.category_id
        ? categoryPolicyByCategoryId.get(p.category_id) ?? null
        : null;
      const productEnt = productPolicyByProductId.get(p.id) ?? null;
      const productPolicy = productEnt?.entity ?? { productId: p.id };

      const bundle = application.defaultResolver.build({
        company: companyEnt.entity,
        category: categoryEnt?.entity,
        product: productPolicy,
        quantity: 1,
        costComposition,
        contextOverrides: { marginTarget: { kind: data.marginTarget } },
        clock: { now: nowIso, tz: "America/Sao_Paulo" },
        requestId: ids.next("recalc"),
        requestedBy: { module: "price-recalculation", userId: context.userId },
        currency: companyEnt.entity.currency,
      });

      const result = application.defaultEngine.compute(bundle.context);
      const belowMinMargin = result.warnings.some((w) => w.code === "MARGIN_BELOW_MIN");
      const originLayer =
        (bundle.resolution.policySource.marginTarget as PolicyLayerName | undefined) ??
        (bundle.resolution.policySource.idealMarginPct as PolicyLayerName | undefined) ??
        (categoryEnt ? "category" : "company");

      const diff = result.finalPriceCents - currentPriceCents;
      const currentMarginPct =
        currentPriceCents > 0
          ? ((currentPriceCents - costComposition.perUnitCostCents) / currentPriceCents) * 100
          : 0;
      const companyDefaults = bundle.context.company.defaults;
      const targetMarginPct =
        (data.marginTarget === "min"
          ? companyDefaults?.minMarginPct
          : data.marginTarget === "premium"
            ? companyDefaults?.premiumMarginPct
            : companyDefaults?.idealMarginPct) ?? result.marginPct;
      const differencePct =
        currentPriceCents > 0 ? (diff / currentPriceCents) * 100 : 0;

      currentSumCents += currentPriceCents;
      recommendedSumCents += result.finalPriceCents;
      if (Math.abs(diff) >= 1) totalDivergent += 1;

      items.push({
        productId: p.id,
        name: p.name,
        sku: p.sku ?? null,
        categoryId: p.category_id,
        categoryName,
        currentPriceCents,
        recommendedPriceCents: result.finalPriceCents,
        differenceCents: diff,
        differencePct,
        currentMarginPct,
        targetMarginPct,
        costTotalCents: result.costTotalCents,
        originLayer,
        originLabel: ORIGIN_LABEL[originLayer] ?? "Sistema",
        hasOwnPolicy: !!productEnt,
        belowMinMargin,
        hasCost: true,
        skipped: false,
        skipReason: null,
      });
    }

    return {
      companyId: data.companyId,
      computedAt: nowIso,
      totalProducts: products.length,
      totalDivergent,
      totalSkipped,
      currentSumCents,
      recommendedSumCents,
      items,
    };
  });
