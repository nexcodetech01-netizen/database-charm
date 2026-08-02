/**
 * Server functions — Product Pricing Intelligence
 * ================================================
 * Ponte entre a UI de Produto e a Application Layer do Pricing.
 *
 * Regras (mesmas de UX-001/UX-002):
 *   - UI NUNCA importa Repositories, Engine ou faz cálculo.
 *   - Toda operação passa por Use Cases (CalculateSuggestedPrice,
 *     ApplySuggestedPrice, RegisterPricingDecision).
 *   - Se o produto ainda não tem ProductPolicy própria, cria uma
 *     entrada mínima via CreateProductPolicy antes de calcular.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerPermission } from "@/features/rbac/guards/server-guards";
import type {
  MarginTargetSpec,
  PricingStepName,
  PricingWarningCode,
} from "@/features/pricing/engine/types";
import type { PolicyLayerName } from "@/features/pricing/resolver/types";

// Shapes serializáveis (sem `Record<string, unknown>` opaco) para atravessar a
// borda RPC do TanStack Start sem violar o contrato de serialização.
export interface PricingStepDTO {
  readonly step: PricingStepName;
  readonly rule: string;
  readonly source: string | null;
  readonly inputCents: number | null;
  readonly outputCents: number | null;
}
export interface PricingWarningDTO {
  readonly code: PricingWarningCode;
  readonly message: string;
  readonly step: PricingStepName | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────────

export type PricingStrategy = "min" | "recommended" | "premium" | "target" | "final";

export interface ProductPricingIntelligenceDTO {
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly categoryId: string | null;
    readonly categoryName: string | null;
    readonly currentPriceCents: number;
    readonly costTotalCents: number;
  };
  readonly hasPolicy: boolean;
  readonly targetMarginPct: number;
  readonly targetMarginKind: MarginTargetSpec["kind"];
  readonly recommendedPriceCents: number;
  readonly finalPriceCents: number;
  readonly minPriceCents: number;
  readonly premiumPriceCents: number;
  readonly differenceCents: number; // final - current
  readonly estimatedMarginPct: number;
  readonly originLayer: PolicyLayerName; // camada que resolveu a margem
  readonly originLabel: string; // rótulo humano ("Categoria", "Empresa", ...)
  readonly computedAt: string;
  readonly explainId: string;
  readonly requestId: string;
  readonly summary: string;
  readonly steps: readonly PricingStepDTO[];
  readonly warnings: readonly PricingWarningDTO[];
}

const ORIGIN_LABEL: Record<PolicyLayerName, string> = {
  product: "Produto",
  category: "Categoria",
  company: "Empresa",
  context: "Contexto",
  system: "Sistema",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos (server-side)
// ─────────────────────────────────────────────────────────────────────────────

interface ProductRow {
  id: string;
  name: string;
  category_id: string | null;
  cost: number | string | null;
  freight: number | string | null;
  packaging: number | string | null;
  insurance: number | string | null;
  other_costs: number | string | null;
  price: number | string | null;
  updated_at: string | null;
  category: { id: string; name: string } | null;
}

const toN = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// getProductPricingIntelligence
// ─────────────────────────────────────────────────────────────────────────────

export const getProductPricingIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string; productId: string }) => {
    if (!input?.companyId) throw new Error("companyId é obrigatório");
    if (!input?.productId) throw new Error("productId é obrigatório");
    return input;
  })
  .handler(async ({ data, context }): Promise<ProductPricingIntelligenceDTO> => {
    const [{ createSupabaseRepositories }, application, engineMod] = await Promise.all([
      import("@/features/pricing/persistence/supabase.server"),
      import("@/features/pricing/application"),
      import("@/features/pricing/engine"),
    ]);

    const repos = createSupabaseRepositories(context.supabase);
    const deps = {
      repositories: repos,
      engine: application.defaultEngine,
      resolver: application.defaultResolver,
      clock: application.systemClock,
      ids: application.createIdGenerator(),
      hasher: application.defaultHasher,
    };
    const actor = { userId: context.userId, module: "product-detail" };

    // Product row
    const prodRes = await context.supabase
      .from("products")
      .select(
        "id, name, category_id, cost, freight, packaging, insurance, other_costs, price, updated_at, category:product_categories(id, name)",
      )
      .eq("company_id", data.companyId)
      .eq("id", data.productId)
      .maybeSingle();
    if (prodRes.error) throw prodRes.error;
    const p = prodRes.data as unknown as ProductRow | null;
    if (!p) throw new Error("Produto não encontrado");

    // Ensure CompanyPolicy exists (bootstrap default — currency BRL,
    // defaults min 10 / ideal 30 / premium 50). Evita "CompanyPolicy not found".
    const companyExisting = await repos.companyPolicies.findByCompany(data.companyId);
    if (!companyExisting) {
      const createCompanyUC = application.createCreateCompanyPolicyUseCase(deps);
      await createCompanyUC.execute({
        input: {
          companyId: data.companyId,
          currency: "BRL",
          defaults: { minMarginPct: 10, idealMarginPct: 30, premiumMarginPct: 50 },
        },
        actor,
      });
    }

    // Ensure ProductPolicy exists (bootstrap sem overrides — herda Categoria/Empresa)
    const existing = await repos.productPolicies.findByProduct(data.companyId, data.productId);
    let hasPolicy = !!existing;
    if (!existing) {
      const createUC = application.createCreateProductPolicyUseCase(deps);
      await createUC.execute({
        companyId: data.companyId,
        input: { productId: data.productId },
        actor,
      });
      hasPolicy = false; // política ainda é "vazia" — herda de camadas superiores
    }

    // Composição de custo: engine é a fonte única — passamos apenas os componentes
    // brutos (em centavos). `perUnitCostCents` é derivado dentro do Pricing Engine
    // (ver src/features/pricing/engine/internal/cost.ts).
    const { fetchCompanyCostDefaults, mergeProductOperationalCosts } =
      await import("@/features/pricing/lib/company-cost-defaults");
    const companyDefaults = await fetchCompanyCostDefaults(context.supabase, data.companyId);
    const merged = mergeProductOperationalCosts(p, companyDefaults);
    const cost = toN(p.cost);
    const freight = merged.freight;
    const packaging = merged.packaging;
    const insurance = merged.insurance;
    const others = merged.otherCosts;
    const currentPriceCents = Math.round(toN(p.price) * 100);

    const nowIso = deps.clock.nowIso();
    const calcUC = application.createCalculateSuggestedPriceUseCase(deps);
    const { bundle, result } = await calcUC.execute({
      companyId: data.companyId,
      productId: data.productId,
      categoryId: p.category_id ?? undefined,
      quantity: 1,
      context: {
        costComposition: engineMod.composeCostComposition({
          acquisitionCostCents: Math.round(cost * 100),
          freightCents: Math.round(freight * 100),
          packagingCents: Math.round(packaging * 100),
          insuranceCents: Math.round(insurance * 100),
          otherExpensesCents: Math.round(others * 100),
          computedAt: p.updated_at ?? nowIso,
          origin: "inventory",
        }),
        currency: "BRL",
        clock: { now: nowIso, tz: "America/Sao_Paulo" },
        contextOverrides: { marginTarget: { kind: "ideal" } },
        requestedBy: { module: "product-detail", userId: context.userId },
      },
    });

    const explanation = deps.engine.explain(result);
    const originLayer =
      (bundle.resolution.policySource.marginTarget as PolicyLayerName | undefined) ??
      (bundle.resolution.policySource.idealMarginPct as PolicyLayerName | undefined) ??
      "company";

    // Deriva targetMarginPct a partir da margem-alvo EFETIVA resolvida pelo motor
    // (produto > categoria > empresa). O motor grava esse valor em
    // appliedRules[step="target"].detail.pct — ver engine/compute.ts.
    const targetRule = result.appliedRules.find((r) => r.step === "target");
    const resolvedTargetPct =
      typeof targetRule?.detail?.pct === "number" ? (targetRule.detail.pct as number) : undefined;
    const targetMarginPct =
      resolvedTargetPct ?? bundle.context.company.defaults?.idealMarginPct ?? result.marginPct;

    return {
      product: {
        id: p.id,
        name: p.name,
        categoryId: p.category_id,
        categoryName: p.category?.name ?? null,
        currentPriceCents,
        costTotalCents: result.costTotalCents,
      },
      hasPolicy,
      targetMarginPct,
      targetMarginKind: "ideal",
      recommendedPriceCents: result.recommendedPriceCents,
      finalPriceCents: result.finalPriceCents,
      minPriceCents: result.minPriceCents,
      premiumPriceCents: result.premiumPriceCents,
      differenceCents: result.finalPriceCents - currentPriceCents,
      estimatedMarginPct: result.marginPct,
      originLayer,
      originLabel: ORIGIN_LABEL[originLayer] ?? "Sistema",
      computedAt: result.computedAt,
      explainId: result.explainId,
      requestId: result.requestId,
      summary: explanation.summary,

      steps: explanation.steps.map((s) => ({
        step: s.step,
        rule: s.rule,
        source: s.source ?? null,
        inputCents: s.inputCents ?? null,
        outputCents: s.outputCents ?? null,
      })),
      warnings: result.warnings.map((w) => ({
        code: w.code,
        message: w.message,
        step: w.step ?? null,
      })),
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// applyProductSuggestedPrice
// ─────────────────────────────────────────────────────────────────────────────

export interface ApplyProductPriceResultDTO {
  readonly productId: string;
  readonly appliedPriceCents: number;
  readonly explainId: string;
  readonly decisionId: string;
}

export const applyProductSuggestedPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string; productId: string; strategy?: PricingStrategy }) => {
    if (!input?.companyId) throw new Error("companyId é obrigatório");
    if (!input?.productId) throw new Error("productId é obrigatório");
    return input;
  })
  .handler(async ({ data, context }): Promise<ApplyProductPriceResultDTO> => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "products.update", {
      companyId: data.companyId,
      action: "pricing.product.apply_price",
      module: "pricing",
    });
    const [{ createSupabaseRepositories }, application, engineMod] = await Promise.all([
      import("@/features/pricing/persistence/supabase.server"),
      import("@/features/pricing/application"),
      import("@/features/pricing/engine"),
    ]);

    const repos = createSupabaseRepositories(context.supabase);
    const deps = {
      repositories: repos,
      engine: application.defaultEngine,
      resolver: application.defaultResolver,
      clock: application.systemClock,
      ids: application.createIdGenerator(),
      hasher: application.defaultHasher,
    };
    const actor = { userId: context.userId, module: "product-detail" };

    // Product row (para cost composition + garantia de existência)
    const prodRes = await context.supabase
      .from("products")
      .select("id, category_id, cost, freight, packaging, insurance, other_costs, updated_at")
      .eq("company_id", data.companyId)
      .eq("id", data.productId)
      .maybeSingle();
    if (prodRes.error) throw prodRes.error;
    const p = prodRes.data as unknown as Pick<
      ProductRow,
      | "id"
      | "category_id"
      | "cost"
      | "freight"
      | "packaging"
      | "insurance"
      | "other_costs"
      | "updated_at"
    > | null;
    if (!p) throw new Error("Produto não encontrado");

    // Ensure CompanyPolicy (bootstrap default)
    const companyExisting = await repos.companyPolicies.findByCompany(data.companyId);
    if (!companyExisting) {
      const createCompanyUC = application.createCreateCompanyPolicyUseCase(deps);
      await createCompanyUC.execute({
        input: {
          companyId: data.companyId,
          currency: "BRL",
          defaults: { minMarginPct: 10, idealMarginPct: 30, premiumMarginPct: 50 },
        },
        actor,
      });
    }

    // Ensure ProductPolicy
    const existing = await repos.productPolicies.findByProduct(data.companyId, data.productId);
    if (!existing) {
      const createUC = application.createCreateProductPolicyUseCase(deps);
      await createUC.execute({
        companyId: data.companyId,
        input: { productId: data.productId },
        actor,
      });
    }

    // Composição de custo: engine é a fonte única (ver internal/cost.ts).
    // Custos operacionais: COALESCE(produto, defaults da empresa).
    const { fetchCompanyCostDefaults, mergeProductOperationalCosts } =
      await import("@/features/pricing/lib/company-cost-defaults");
    const companyDefaults = await fetchCompanyCostDefaults(context.supabase, data.companyId);
    const merged = mergeProductOperationalCosts(p, companyDefaults);
    const cost = toN(p.cost);
    const freight = merged.freight;
    const packaging = merged.packaging;
    const insurance = merged.insurance;
    const others = merged.otherCosts;
    const nowIso = deps.clock.nowIso();

    const applyUC = application.createApplySuggestedPriceUseCase(deps);
    const { command, snapshot } = await applyUC.execute({
      companyId: data.companyId,
      productId: data.productId,
      categoryId: p.category_id ?? undefined,
      quantity: 1,
      strategy: data.strategy ?? "final",
      actor,
      context: {
        costComposition: engineMod.composeCostComposition({
          acquisitionCostCents: Math.round(cost * 100),
          freightCents: Math.round(freight * 100),
          packagingCents: Math.round(packaging * 100),
          insuranceCents: Math.round(insurance * 100),
          otherExpensesCents: Math.round(others * 100),
          computedAt: p.updated_at ?? nowIso,
          origin: "inventory",
        }),
        currency: "BRL",
        clock: { now: nowIso, tz: "America/Sao_Paulo" },
        contextOverrides: { marginTarget: { kind: "ideal" } },
        requestedBy: { module: "product-detail", userId: context.userId },
      },
    });

    // Atualiza o preço do produto (Product Domain — direto, mesmo padrão do resto do app)
    const newPriceReais = command.priceCents / 100;
    const upd = await context.supabase
      .from("products")
      .update({ price: newPriceReais })
      .eq("company_id", data.companyId)
      .eq("id", data.productId);
    if (upd.error) throw upd.error;

    // Auditoria append-only
    const registerUC = application.createRegisterPricingDecisionUseCase(deps);
    const stored = await registerUC.execute({ snapshot });

    return {
      productId: data.productId,
      appliedPriceCents: command.priceCents,
      explainId: command.explainId,
      decisionId: stored.id,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// syncProductIdealMargin
// ─────────────────────────────────────────────────────────────────────────────
// Sincroniza a margem editada no formulário do Produto com a camada
// ProductPolicy do motor de precificação. O engine já resolve
// contextOverrides { marginTarget: { kind: "ideal" } } respeitando o
// override da camada Produto — basta gravar `idealMarginPct` aqui para que
// todos os canais (Loja Física, Site, Mercado Livre, Shopee, Amazon)
// recalculem usando a mesma margem.
//
// Preserva quaisquer outros overrides já existentes na policy do produto
// (min/premium, roundingPolicy, marginTarget custom, etc.).

export interface SyncProductIdealMarginResultDTO {
  readonly synced: boolean;
  readonly skipped: boolean;
  readonly reason?: "invalid-margin";
  readonly idealMarginPct?: number;
  readonly created?: boolean;
}

export const syncProductIdealMargin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string; productId: string; idealMarginPct: number }) => {
    if (!input?.companyId) throw new Error("companyId é obrigatório");
    if (!input?.productId) throw new Error("productId é obrigatório");
    if (typeof input.idealMarginPct !== "number")
      throw new Error("idealMarginPct deve ser numérico");
    return input;
  })
  .handler(async ({ data, context }): Promise<SyncProductIdealMarginResultDTO> => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "products.update", {
      companyId: data.companyId,
      action: "pricing.product.sync_margin",
      module: "pricing",
    });
    // Regra de negócio (mesma guarda do trigger
    // apply_category_margin_to_products): ignora margens fora de (0, 100).
    if (
      !Number.isFinite(data.idealMarginPct) ||
      data.idealMarginPct <= 0 ||
      data.idealMarginPct >= 100
    ) {
      return { synced: false, skipped: true, reason: "invalid-margin" };
    }

    const [{ createSupabaseRepositories }, application] = await Promise.all([
      import("@/features/pricing/persistence/supabase.server"),
      import("@/features/pricing/application"),
    ]);

    const repos = createSupabaseRepositories(context.supabase);
    const deps = {
      repositories: repos,
      engine: application.defaultEngine,
      resolver: application.defaultResolver,
      clock: application.systemClock,
      ids: application.createIdGenerator(),
      hasher: application.defaultHasher,
    };
    const actor = { userId: context.userId, module: "product-form" };

    // Garante CompanyPolicy (mesmo bootstrap dos outros server fns deste módulo).
    const companyExisting = await repos.companyPolicies.findByCompany(data.companyId);
    if (!companyExisting) {
      const createCompanyUC = application.createCreateCompanyPolicyUseCase(deps);
      await createCompanyUC.execute({
        input: {
          companyId: data.companyId,
          currency: "BRL",
          defaults: { minMarginPct: 10, idealMarginPct: 30, premiumMarginPct: 50 },
        },
        actor,
      });
    }

    const existing = await repos.productPolicies.findByProduct(data.companyId, data.productId);

    if (!existing) {
      const createUC = application.createCreateProductPolicyUseCase(deps);
      await createUC.execute({
        companyId: data.companyId,
        input: {
          productId: data.productId,
          idealMarginPct: data.idealMarginPct,
        },
        actor,
      });
      return {
        synced: true,
        skipped: false,
        created: true,
        idealMarginPct: data.idealMarginPct,
      };
    }

    // Preserva TODOS os campos existentes (min/premium, marginTarget,
    // roundingPolicy, priceFloorCents, sku, commercialBehavior) e
    // sobrescreve apenas idealMarginPct. Concorrência otimista via version.
    const updateUC = application.createUpdateProductPolicyUseCase(deps);
    await updateUC.execute({
      companyId: data.companyId,
      expectedVersion: existing.meta.version,
      input: {
        productId: existing.entity.productId,
        sku: existing.entity.sku,
        priceFloorCents: existing.entity.priceFloorCents,
        marginTarget: existing.entity.marginTarget,
        commercialBehavior: existing.entity.commercialBehavior,
        roundingPolicy: existing.entity.roundingPolicy,
        minMarginPct: existing.entity.minMarginPct,
        premiumMarginPct: existing.entity.premiumMarginPct,
        idealMarginPct: data.idealMarginPct,
      },
      actor,
    });

    return {
      synced: true,
      skipped: false,
      created: false,
      idealMarginPct: data.idealMarginPct,
    };
  });
