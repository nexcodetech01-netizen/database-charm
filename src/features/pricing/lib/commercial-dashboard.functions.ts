/**
 * Server function — Commercial Dashboard (UX-005)
 * ================================================
 * Ponte entre a UI do Dashboard Comercial e a Application Layer do Pricing.
 *
 * REGRAS (idênticas às demais UX de Pricing):
 *   - UI NUNCA importa Repositories, Engine, Resolver ou faz cálculo.
 *   - Toda leitura de política + cálculo passa pelos ports da Application Layer:
 *       • defaultResolver.build()
 *       • defaultEngine.compute()
 *   - Nenhum cálculo novo — apenas agrega o que o Core devolve.
 *   - Sem persistência.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PolicyLayerName } from "@/features/pricing/resolver/types";

// ─────────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────────

export type CommercialHealthLevel = "excellent" | "very_good" | "attention" | "critical";

export interface CommercialHealthDTO {
  readonly level: CommercialHealthLevel;
  readonly stars: number; // 2..5
  readonly label: string;
  readonly summary: string;
}

export interface CommercialKpisDTO {
  readonly productsTotal: number;
  readonly productsWithOwnPolicy: number;
  readonly productsInheritingPolicy: number;
  readonly productsBelowMargin: number;
  readonly productsWithoutCost: number;
  readonly productsWithoutPrice: number;
  readonly productsWithSuggestion: number;
  readonly lastUpdatedAt: string;
}

export type OpportunityKind =
  | "increase_profit"
  | "below_min_margin"
  | "categories_without_policy"
  | "review_price";

export interface CommercialOpportunityDTO {
  readonly kind: OpportunityKind;
  readonly count: number;
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly actionHref: string;
}

export interface PriorityProductDTO {
  readonly productId: string;
  readonly name: string;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly currentPriceCents: number;
  readonly recommendedPriceCents: number;
  readonly differenceCents: number;
  readonly marginPct: number;
  readonly originLayer: PolicyLayerName;
  readonly originLabel: string;
}

export interface CategorySummaryDTO {
  readonly categoryId: string;
  readonly name: string;
  readonly averageMarginPct: number;
  readonly productsCount: number;
  readonly pendingProducts: number;
  readonly strategyLabel: string;
  readonly hasOwnPolicy: boolean;
}

export interface RecentDecisionDTO {
  readonly id: string;
  readonly explainId: string;
  readonly productId: string | null;
  readonly productName: string | null;
  readonly previousPriceCents: number | null;
  readonly appliedPriceCents: number;
  readonly createdAt: string;
  readonly userId: string | null;
}

export interface CommercialInsightDTO {
  readonly id: string;
  readonly text: string;
  readonly tone: "positive" | "neutral" | "warning";
}

export type PriceReviewReason =
  | "cost_changed"
  | "below_min_margin"
  | "price_differs"
  | "no_policy"
  | "pending_suggestion";

export interface PriceReviewItemDTO {
  readonly productId: string;
  readonly name: string;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly supplierId: string | null;
  readonly supplierName: string | null;
  readonly currentPriceCents: number;
  readonly recommendedPriceCents: number;
  readonly differenceCents: number;
  readonly currentMarginPct: number;
  readonly targetMarginPct: number;
  readonly originLayer: PolicyLayerName;
  readonly originLabel: string;
  readonly reasons: readonly PriceReviewReason[];
  readonly primaryReason: PriceReviewReason;
  readonly hasOwnPolicy: boolean;
  readonly lastUpdatedAt: string;
}

export interface CommercialDashboardDTO {
  readonly health: CommercialHealthDTO;
  readonly kpis: CommercialKpisDTO;
  readonly opportunities: readonly CommercialOpportunityDTO[];
  readonly priorityProducts: readonly PriorityProductDTO[];
  readonly categories: readonly CategorySummaryDTO[];
  readonly recentDecisions: readonly RecentDecisionDTO[];
  readonly insights: readonly CommercialInsightDTO[];
  readonly reviewList: readonly PriceReviewItemDTO[];
}

export const PRICE_REVIEW_REASON_LABEL: Record<PriceReviewReason, string> = {
  cost_changed: "Custo alterado",
  below_min_margin: "Abaixo da margem",
  price_differs: "Preço diferente do sugerido",
  no_policy: "Sem política",
  pending_suggestion: "Sugestão pendente",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

const STRATEGY_LABEL: Record<string, string> = {
  standard: "Padrão",
  high_turnover: "Alto giro",
  promotion: "Promoção",
  stock_burn: "Queima de estoque",
};

// Cap defensivo para manter a resposta rápida em catálogos grandes.
const MAX_PRODUCTS_ANALYZED = 400;

// ─────────────────────────────────────────────────────────────────────────────
// getCommercialDashboard
// ─────────────────────────────────────────────────────────────────────────────

export const getCommercialDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) => {
    if (!input?.companyId) throw new Error("companyId é obrigatório");
    return input;
  })
  .handler(async ({ data, context }): Promise<CommercialDashboardDTO> => {
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

    const [companyEnt, categoryPolicies, productPolicies, categoriesRes, productsRes, decisionsRes] =
      await Promise.all([
        repos.companyPolicies.findByCompany(data.companyId),
        repos.categoryPolicies.listByCompany(data.companyId),
        repos.productPolicies.listByCompany(data.companyId),
        context.supabase
          .from("product_categories")
          .select("id, name")
          .eq("company_id", data.companyId)
          .order("name"),
        context.supabase
          .from("products")
          .select(
            "id, name, category_id, supplier_id, cost, freight, packaging, insurance, other_costs, price, updated_at",
          )
          .eq("company_id", data.companyId)
          .limit(MAX_PRODUCTS_ANALYZED),
        repos.pricingDecisions.query({ companyId: data.companyId, limit: 200 }),
      ]);

    if (categoriesRes.error) throw categoriesRes.error;
    if (productsRes.error) throw productsRes.error;

    const categoriesRaw = (categoriesRes.data ?? []) as Array<{
      id: string;
      name: string;
    }>;
    const categoryNameById = new Map(categoriesRaw.map((c) => [c.id, c.name]));

    const categoryPolicyByCategoryId = new Map(
      categoryPolicies.map((p) => [p.entity.categoryId, p]),
    );
    const productPolicyByProductId = new Map(
      productPolicies.map((p) => [p.entity.productId, p]),
    );

    const products = (productsRes.data ?? []) as Array<{
      id: string;
      name: string;
      category_id: string | null;
      supplier_id: string | null;
      cost: number | string | null;
      freight: number | string | null;
  packaging: number | string | null;
      insurance: number | string | null;
      other_costs: number | string | null;
      price: number | string | null;
      updated_at: string | null;
    }>;

    // Fornecedores (batch, sem cálculo — apenas para exibir na Central de Revisão)
    const supplierIds = Array.from(
      new Set(products.map((p) => p.supplier_id).filter((v): v is string => !!v)),
    );
    let supplierNameById = new Map<string, string>();
    if (supplierIds.length > 0) {
      const supRes = await context.supabase
        .from("product_suppliers")
        .select("id, name")
        .eq("company_id", data.companyId)
        .in("id", supplierIds);
      if (!supRes.error) {
        supplierNameById = new Map(
          (supRes.data ?? []).map((r: { id: string; name: string }) => [r.id, r.name]),
        );
      }
    }

    // Última decisão registrada por produto (custo/preço aplicado — para detectar "custo alterado")
    interface LastDecision {
      readonly perUnitCostCents: number;
      readonly appliedPriceCents: number;
      readonly createdAt: string;
    }
    const lastDecisionByProductId = new Map<string, LastDecision>();
    for (const d of decisionsRes) {
      const pid = d.snapshot.context.product?.id;
      if (!pid) continue;
      if (lastDecisionByProductId.has(pid)) continue; // decisionsRes vem desc por createdAt
      lastDecisionByProductId.set(pid, {
        perUnitCostCents:
          d.snapshot.context.costComposition?.perUnitCostCents ?? 0,
        appliedPriceCents: d.snapshot.result.finalPriceCents,
        createdAt: d.createdAt,
      });
    }


    // ─── Deriva agregados via Application Layer (defaultResolver + defaultEngine)
    interface Computed {
      readonly product: (typeof products)[number];
      readonly perUnitCostCents: number;
      readonly recommendedPriceCents: number;
      readonly currentPriceCents: number;
      readonly marginPct: number; // margem recomendada
      readonly currentMarginPct: number; // margem sobre preço atual
      readonly targetMarginPct: number;
      readonly originLayer: PolicyLayerName;
      readonly hasOwnPolicy: boolean;
      readonly belowMinMargin: boolean;
      readonly hasSuggestion: boolean;
    }

    const computed: Computed[] = [];
    let productsWithoutCost = 0;
    let productsWithoutPrice = 0;

    if (companyEnt) {
      for (const p of products) {
        const cost = toN(p.cost);
        const mergedCosts = costDefaultsMod.mergeProductOperationalCosts(p, companyCostDefaults);
        const freight = mergedCosts.freight;
        const packaging = mergedCosts.packaging;
        const insurance = mergedCosts.insurance;
        const others = mergedCosts.otherCosts;

        // Composição de custo — engine é a fonte única (ver internal/cost.ts).
        const costComposition = engineMod.composeCostComposition({
          acquisitionCostCents: Math.round(cost * 100),
          freightCents: Math.round(freight * 100),
          packagingCents: Math.round(packaging * 100),
          insuranceCents: Math.round(insurance * 100),
          otherExpensesCents: Math.round(others * 100),
          computedAt: p.updated_at ?? nowIso,
          origin: "inventory",
        });
        const perUnitCostCents = costComposition.perUnitCostCents;
        const currentPriceCents = Math.round(toN(p.price) * 100);

        if (perUnitCostCents <= 0) productsWithoutCost += 1;
        if (currentPriceCents <= 0) productsWithoutPrice += 1;
        if (perUnitCostCents <= 0) continue; // engine requires cost > 0 to compute margin

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
          contextOverrides: { marginTarget: { kind: "ideal" } },
          clock: { now: nowIso, tz: "America/Sao_Paulo" },
          requestId: ids.next("dash"),
          requestedBy: { module: "commercial-dashboard", userId: context.userId },
          currency: companyEnt.entity.currency,
        });


        const result = application.defaultEngine.compute(bundle.context);
        const belowMinMargin = result.warnings.some((w) => w.code === "MARGIN_BELOW_MIN");
        const originLayer =
          (bundle.resolution.policySource.marginTarget as PolicyLayerName | undefined) ??
          (bundle.resolution.policySource.idealMarginPct as PolicyLayerName | undefined) ??
          (categoryEnt ? "category" : "company");

        const diff = result.finalPriceCents - currentPriceCents;
        const hasSuggestion = currentPriceCents > 0 && Math.abs(diff) >= 100; // >= R$1,00

        const currentMarginPct =
          currentPriceCents > 0
            ? ((currentPriceCents - perUnitCostCents) / currentPriceCents) * 100
            : 0;
        const targetMarginPct =
          bundle.context.company.defaults?.idealMarginPct ?? result.marginPct;

        computed.push({
          product: p,
          perUnitCostCents,
          recommendedPriceCents: result.finalPriceCents,
          currentPriceCents,
          marginPct: result.marginPct,
          currentMarginPct,
          targetMarginPct,
          originLayer,
          hasOwnPolicy: !!productEnt,
          belowMinMargin,
          hasSuggestion,
        });
      }
    }

    // ─── KPIs
    const productsTotal = products.length;
    const productsWithOwnPolicy = productPolicies.length;
    const productsInheritingPolicy = Math.max(
      0,
      productsTotal - productsWithOwnPolicy,
    );
    const productsBelowMargin = computed.filter((c) => c.belowMinMargin).length;
    const productsWithSuggestion = computed.filter((c) => c.hasSuggestion).length;

    const kpis: CommercialKpisDTO = {
      productsTotal,
      productsWithOwnPolicy,
      productsInheritingPolicy,
      productsBelowMargin,
      productsWithoutCost,
      productsWithoutPrice,
      productsWithSuggestion,
      lastUpdatedAt: nowIso,
    };

    // ─── Categorias sem política própria
    const categoriesWithoutPolicy = categoriesRaw.filter(
      (c) => !categoryPolicyByCategoryId.has(c.id),
    );

    // ─── Oportunidades
    const opportunities: CommercialOpportunityDTO[] = [];
    const profitOpportunities = computed.filter(
      (c) => c.hasSuggestion && c.recommendedPriceCents > c.currentPriceCents,
    ).length;
    if (profitOpportunities > 0) {
      opportunities.push({
        kind: "increase_profit",
        count: profitOpportunities,
        title: `${profitOpportunities} produtos podem aumentar lucro`,
        description: "Preço recomendado acima do praticado atualmente.",
        actionLabel: "Ver produtos",
        actionHref: "/produtos",
      });
    }
    if (productsBelowMargin > 0) {
      opportunities.push({
        kind: "below_min_margin",
        count: productsBelowMargin,
        title: `${productsBelowMargin} produtos abaixo da margem mínima`,
        description: "Ajustar preço ou revisar composição de custo.",
        actionLabel: "Revisar",
        actionHref: "/produtos",
      });
    }
    if (categoriesWithoutPolicy.length > 0) {
      opportunities.push({
        kind: "categories_without_policy",
        count: categoriesWithoutPolicy.length,
        title: `${categoriesWithoutPolicy.length} categorias sem política própria`,
        description: "Definir margens específicas por categoria.",
        actionLabel: "Configurar categorias",
        actionHref: "/inteligencia-comercial/categorias",
      });
    }
    if (productsWithSuggestion > 0) {
      opportunities.push({
        kind: "review_price",
        count: productsWithSuggestion,
        title: `${productsWithSuggestion} produtos precisam revisar preço`,
        description: "Diferença relevante entre preço atual e recomendado.",
        actionLabel: "Simular",
        actionHref: "/inteligencia-comercial/simulador",
      });
    }

    // ─── Produtos prioritários (top 8 por magnitude de diferença)
    const priorityProducts: PriorityProductDTO[] = [...computed]
      .filter((c) => c.hasSuggestion)
      .sort(
        (a, b) =>
          Math.abs(b.recommendedPriceCents - b.currentPriceCents) -
          Math.abs(a.recommendedPriceCents - a.currentPriceCents),
      )
      .slice(0, 8)
      .map((c) => ({
        productId: c.product.id,
        name: c.product.name,
        categoryId: c.product.category_id,
        categoryName: c.product.category_id
          ? categoryNameById.get(c.product.category_id) ?? null
          : null,
        currentPriceCents: c.currentPriceCents,
        recommendedPriceCents: c.recommendedPriceCents,
        differenceCents: c.recommendedPriceCents - c.currentPriceCents,
        marginPct: c.marginPct,
        originLayer: c.originLayer,
        originLabel: ORIGIN_LABEL[c.originLayer] ?? "Sistema",
      }));

    // ─── Resumo por categoria
    const marginsByCategory = new Map<string, number[]>();
    const pendingByCategory = new Map<string, number>();
    for (const c of computed) {
      const catId = c.product.category_id;
      if (!catId) continue;
      const arr = marginsByCategory.get(catId) ?? [];
      arr.push(c.marginPct);
      marginsByCategory.set(catId, arr);
      if (c.hasSuggestion || c.belowMinMargin) {
        pendingByCategory.set(catId, (pendingByCategory.get(catId) ?? 0) + 1);
      }
    }

    const categoriesSummary: CategorySummaryDTO[] = categoriesRaw.map((c) => {
      const marginsList = marginsByCategory.get(c.id) ?? [];
      const productsCount = marginsList.length;
      const avg =
        productsCount > 0
          ? marginsList.reduce((s, v) => s + v, 0) / productsCount
          : 0;
      const policy = categoryPolicyByCategoryId.get(c.id) ?? null;
      const strategyKind = policy?.entity.commercialBehavior?.kind ?? "standard";
      return {
        categoryId: c.id,
        name: c.name,
        averageMarginPct: avg,
        productsCount,
        pendingProducts: pendingByCategory.get(c.id) ?? 0,
        strategyLabel: STRATEGY_LABEL[strategyKind] ?? strategyKind,
        hasOwnPolicy: !!policy,
      };
    });

    // ─── Últimas decisões (produtos referenciados pelo snapshot do Core)
    const decisions = decisionsRes;
    const decisionProductIds = new Set<string>();
    for (const d of decisions) {
      const pid = d.snapshot.context.product?.id;
      if (pid) decisionProductIds.add(pid);
    }
    let productNameById = new Map<string, string>();
    if (decisionProductIds.size > 0) {
      const namesRes = await context.supabase
        .from("products")
        .select("id, name")
        .eq("company_id", data.companyId)
        .in("id", Array.from(decisionProductIds));
      if (!namesRes.error) {
        productNameById = new Map(
          (namesRes.data ?? []).map((r: { id: string; name: string }) => [r.id, r.name]),
        );
      }
    }

    const recentDecisions: RecentDecisionDTO[] = decisions.map((d) => {
      const pid = d.snapshot.context.product?.id ?? null;
      const applied = d.snapshot.result.finalPriceCents;
      // Preço anterior: procura o step "floor" ou o primeiro inputCents de "target"
      const firstStep = d.snapshot.appliedRules.find((r) => r.step === "target");
      const previous = firstStep?.inputCents ?? null;
      return {
        id: d.id,
        explainId: d.snapshot.explainId,
        productId: pid,
        productName: pid ? productNameById.get(pid) ?? null : null,
        previousPriceCents: previous,
        appliedPriceCents: applied,
        createdAt: d.createdAt,
        userId: d.snapshot.createdBy ?? null,
      };
    });

    // ─── Insights (derivados de dados existentes — sem IA, sem texto inventado)
    const insights: CommercialInsightDTO[] = [];
    if (categoriesSummary.length > 0) {
      const top = [...categoriesSummary]
        .filter((c) => c.productsCount > 0)
        .sort((a, b) => b.averageMarginPct - a.averageMarginPct)[0];
      if (top) {
        insights.push({
          id: "top-category-margin",
          text: `A categoria "${top.name}" possui a maior margem média (${top.averageMarginPct.toFixed(1)}%).`,
          tone: "positive",
        });
      }
    }
    if (productsInheritingPolicy > 0) {
      insights.push({
        id: "inheriting-policy",
        text: `${productsInheritingPolicy} produtos ainda utilizam política herdada.`,
        tone: "neutral",
      });
    }
    if (productsBelowMargin > 0) {
      insights.push({
        id: "below-min-margin",
        text: `${productsBelowMargin} produtos estão abaixo da margem mínima definida.`,
        tone: "warning",
      });
    }
    if (productsWithoutCost > 0) {
      insights.push({
        id: "missing-cost",
        text: `${productsWithoutCost} produtos não possuem custo cadastrado.`,
        tone: "warning",
      });
    }
    if (categoriesWithoutPolicy.length > 0) {
      insights.push({
        id: "categories-no-policy",
        text: `${categoriesWithoutPolicy.length} categorias ainda herdam a política da empresa.`,
        tone: "neutral",
      });
    }

    // ─── Saúde Comercial (classificação de KPIs — não é regra de negócio)
    const health = deriveHealth({
      productsTotal,
      productsBelowMargin,
      productsWithoutCost,
      productsWithoutPrice,
      productsWithSuggestion,
      hasCompanyPolicy: !!companyEnt,
    });

    // ─── Central de Revisão de Preços (UX-006) — sem cálculo novo, apenas classificação
    const reviewList: PriceReviewItemDTO[] = [];
    for (const c of computed) {
      const last = lastDecisionByProductId.get(c.product.id);
      const costChanged =
        !!last && Math.abs(last.perUnitCostCents - c.perUnitCostCents) >= 1;
      // "pending_suggestion": há sugestão e nunca foi aplicada uma decisão que já
      // reflita esse preço recomendado.
      const pending =
        c.hasSuggestion &&
        (!last || last.appliedPriceCents !== c.recommendedPriceCents);
      // "no_policy": nem produto nem categoria têm política própria
      const catPolicy = c.product.category_id
        ? categoryPolicyByCategoryId.get(c.product.category_id)
        : null;
      const noPolicy = !c.hasOwnPolicy && !catPolicy;

      const reasons: PriceReviewReason[] = [];
      if (costChanged) reasons.push("cost_changed");
      if (c.belowMinMargin) reasons.push("below_min_margin");
      if (c.hasSuggestion) reasons.push("price_differs");
      if (noPolicy) reasons.push("no_policy");
      if (pending) reasons.push("pending_suggestion");

      if (reasons.length === 0) continue;

      // Prioridade: below_min_margin > cost_changed > price_differs > pending_suggestion > no_policy
      const priority: PriceReviewReason[] = [
        "below_min_margin",
        "cost_changed",
        "price_differs",
        "pending_suggestion",
        "no_policy",
      ];
      const primary =
        priority.find((r) => reasons.includes(r)) ?? reasons[0];

      reviewList.push({
        productId: c.product.id,
        name: c.product.name,
        categoryId: c.product.category_id,
        categoryName: c.product.category_id
          ? categoryNameById.get(c.product.category_id) ?? null
          : null,
        supplierId: c.product.supplier_id,
        supplierName: c.product.supplier_id
          ? supplierNameById.get(c.product.supplier_id) ?? null
          : null,
        currentPriceCents: c.currentPriceCents,
        recommendedPriceCents: c.recommendedPriceCents,
        differenceCents: c.recommendedPriceCents - c.currentPriceCents,
        currentMarginPct: c.currentMarginPct,
        targetMarginPct: c.targetMarginPct,
        originLayer: c.originLayer,
        originLabel: ORIGIN_LABEL[c.originLayer] ?? "Sistema",
        reasons,
        primaryReason: primary,
        hasOwnPolicy: c.hasOwnPolicy,
        lastUpdatedAt: c.product.updated_at ?? nowIso,
      });
    }
    // Ordena por severidade (below_min_margin primeiro) e depois maior diferença
    const REASON_WEIGHT: Record<PriceReviewReason, number> = {
      below_min_margin: 5,
      cost_changed: 4,
      price_differs: 3,
      pending_suggestion: 2,
      no_policy: 1,
    };
    reviewList.sort((a, b) => {
      const w = REASON_WEIGHT[b.primaryReason] - REASON_WEIGHT[a.primaryReason];
      if (w !== 0) return w;
      return Math.abs(b.differenceCents) - Math.abs(a.differenceCents);
    });

    return {
      health,
      kpis,
      opportunities,
      priorityProducts,
      categories: categoriesSummary,
      recentDecisions,
      insights,
      reviewList,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Classificação da Saúde Comercial — presentation only
// ─────────────────────────────────────────────────────────────────────────────

function deriveHealth(input: {
  productsTotal: number;
  productsBelowMargin: number;
  productsWithoutCost: number;
  productsWithoutPrice: number;
  productsWithSuggestion: number;
  hasCompanyPolicy: boolean;
}): CommercialHealthDTO {
  if (!input.hasCompanyPolicy || input.productsTotal === 0) {
    return {
      level: "attention",
      stars: 3,
      label: "Atenção",
      summary: "Configure a política comercial da empresa para começar.",
    };
  }
  const belowPct = input.productsBelowMargin / input.productsTotal;
  const missingPct =
    (input.productsWithoutCost + input.productsWithoutPrice) / input.productsTotal;

  if (belowPct >= 0.25 || missingPct >= 0.4) {
    return {
      level: "critical",
      stars: 2,
      label: "Crítico",
      summary: "Muitos produtos abaixo da margem ou sem dados essenciais.",
    };
  }
  if (belowPct >= 0.1 || missingPct >= 0.2 || input.productsWithSuggestion > 10) {
    return {
      level: "attention",
      stars: 3,
      label: "Atenção",
      summary: "Existem ajustes de preço recomendados que podem elevar o lucro.",
    };
  }
  if (input.productsWithSuggestion > 0 || missingPct > 0) {
    return {
      level: "very_good",
      stars: 4,
      label: "Muito Bom",
      summary: "Base saudável com pequenos ajustes pontuais.",
    };
  }
  return {
    level: "excellent",
    stars: 5,
    label: "Excelente",
    summary: "Catálogo alinhado com a política comercial da empresa.",
  };
}
