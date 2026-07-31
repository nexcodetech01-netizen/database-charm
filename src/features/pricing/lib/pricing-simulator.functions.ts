/**
 * Server functions — Pricing Simulator (UX-004)
 * =============================================
 * Ponte entre a UI do Simulador e a Application Layer do Pricing.
 *
 * REGRAS (idênticas às demais UX de Pricing):
 *   - UI NUNCA importa Repositories, Engine, Resolver ou faz cálculo.
 *   - Toda simulação usa exclusivamente:
 *       • defaultResolver.build()   (Application Layer port)
 *       • defaultEngine.compute()   (Application Layer port)
 *       • defaultEngine.explain()   (Application Layer port)
 *   - Nada é persistido — simulação pura.
 *   - CompanyPolicy e CategoryPolicy são LIDAS via Repositories no server,
 *     mas todo o cálculo passa pelos ports da Application Layer.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  MarginTargetSpec,
  PricingStepName,
  PricingWarningCode,
} from "@/features/pricing/engine/types";
import type { PolicyLayerName } from "@/features/pricing/resolver/types";

// ─────────────────────────────────────────────────────────────────────────────
// DTOs de bootstrap (Categorias + Canais + política vigente)
// ─────────────────────────────────────────────────────────────────────────────

export interface SimulatorCategoryOption {
  readonly id: string;
  readonly name: string;
  readonly hasOwnPolicy: boolean;
}

export interface SimulatorChannelOption {
  readonly id: string; // channelId ("none" = sem canal)
  readonly label: string;
  readonly variableFeePct: number;
  readonly fixedFeePerOrderCents: number;
  readonly operationalCostCents: number;
}

export interface SimulatorBootstrapDTO {
  readonly companyPolicy: {
    readonly currency: string;
    readonly minMarginPct: number;
    readonly idealMarginPct: number;
    readonly premiumMarginPct: number;
    readonly version: number;
  } | null;
  readonly categories: readonly SimulatorCategoryOption[];
  readonly channels: readonly SimulatorChannelOption[];
}

/** Canais oferecidos ao simulador (parâmetros fixos — nenhuma regra nova). */
const CHANNEL_PRESETS: readonly SimulatorChannelOption[] = [
  { id: "none",   label: "Sem canal",  variableFeePct: 0,   fixedFeePerOrderCents: 0, operationalCostCents: 0 },
  { id: "pix",    label: "PIX",        variableFeePct: 0,   fixedFeePerOrderCents: 0, operationalCostCents: 0 },
  { id: "card",   label: "Cartão",     variableFeePct: 3.5, fixedFeePerOrderCents: 0, operationalCostCents: 0 },
  { id: "boleto", label: "Boleto",     variableFeePct: 0,   fixedFeePerOrderCents: 350, operationalCostCents: 0 },
];

export const getPricingSimulatorBootstrap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) => {
    if (!input?.companyId) throw new Error("companyId é obrigatório");
    return input;
  })
  .handler(async ({ data, context }): Promise<SimulatorBootstrapDTO> => {
    const { createSupabaseRepositories } = await import(
      "@/features/pricing/persistence/supabase.server"
    );
    const repos = createSupabaseRepositories(context.supabase);

    const [policy, categoryPolicies, categoriesRes] = await Promise.all([
      repos.companyPolicies.findByCompany(data.companyId),
      repos.categoryPolicies.listByCompany(data.companyId),
      context.supabase
        .from("product_categories")
        .select("id, name, status")
        .eq("company_id", data.companyId)
        .order("name"),
    ]);
    if (categoriesRes.error) throw categoriesRes.error;

    const ownPolicyIds = new Set(categoryPolicies.map((p) => p.entity.categoryId));

    return {
      companyPolicy: policy
        ? {
            currency: policy.entity.currency,
            minMarginPct: policy.entity.defaults?.minMarginPct ?? 0,
            idealMarginPct: policy.entity.defaults?.idealMarginPct ?? 0,
            premiumMarginPct: policy.entity.defaults?.premiumMarginPct ?? 0,
            version: policy.meta.version,
          }
        : null,
      categories: (categoriesRes.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        hasOwnPolicy: ownPolicyIds.has(c.id),
      })),
      channels: CHANNEL_PRESETS,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// simulatePricing — resolver + engine (ports) — sem persistência
// ─────────────────────────────────────────────────────────────────────────────

export type SimulatorMarginKind = MarginTargetSpec["kind"]; // "min" | "ideal" | "premium" | "custom"

export interface SimulatePricingInput {
  readonly companyId: string;
  readonly categoryId?: string | null;
  readonly channelId?: string | null;
  readonly costCents: number;
  readonly freightCents?: number;
  readonly packagingCents?: number;
  readonly insuranceCents?: number;
  readonly otherCostsCents?: number;

  readonly quantity: number;
  readonly marginTarget?: SimulatorMarginKind;
  readonly customMarginPct?: number;
  readonly currentPriceCents?: number | null;
}

export interface SimulatorStepDTO {
  readonly step: PricingStepName;
  readonly rule: string;
  readonly source: string | null;
  readonly inputCents: number | null;
  readonly outputCents: number | null;
}

export interface SimulatorWarningDTO {
  readonly code: PricingWarningCode;
  readonly message: string;
  readonly step: PricingStepName | null;
}

export interface SimulatorComparisonDTO {
  readonly currentPriceCents: number;
  readonly recommendedPriceCents: number;
  readonly differenceCents: number;
  readonly differencePct: number; // sobre preço atual
  readonly profitImpactCents: number; // (final - current) * quantity
}

export interface SimulatePricingDTO {
  readonly currency: string;
  readonly quantity: number;
  readonly costTotalCents: number;
  readonly minPriceCents: number;
  readonly recommendedPriceCents: number;
  readonly premiumPriceCents: number;
  readonly targetPriceCents: number;
  readonly finalPriceCents: number;
  readonly grossProfitCents: number;
  readonly netProfitCents: number;
  readonly marginPct: number;
  readonly markupPct: number;
  readonly originLayer: PolicyLayerName;
  readonly originLabel: string;
  readonly strategyLabel: string;
  readonly policyVersion: string;
  readonly explainId: string;
  readonly requestId: string;
  readonly computedAt: string;
  readonly summary: string;
  readonly steps: readonly SimulatorStepDTO[];
  readonly warnings: readonly SimulatorWarningDTO[];
  readonly comparison: SimulatorComparisonDTO | null;
}

const ORIGIN_LABEL: Record<PolicyLayerName, string> = {
  product: "Produto",
  category: "Categoria",
  company: "Empresa",
  context: "Contexto",
  system: "Sistema",
};

const STRATEGY_LABEL: Record<SimulatorMarginKind, string> = {
  min: "Margem mínima",
  ideal: "Margem ideal",
  premium: "Margem premium",
  custom: "Margem personalizada",
};

export const simulatePricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SimulatePricingInput) => {
    if (!input?.companyId) throw new Error("companyId é obrigatório");
    if (!Number.isFinite(input.costCents) || input.costCents < 0) {
      throw new Error("Custo inválido");
    }
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      throw new Error("Quantidade deve ser maior que zero");
    }
    if (input.marginTarget === "custom") {
      if (!Number.isFinite(input.customMarginPct ?? NaN)) {
        throw new Error("Margem personalizada é obrigatória");
      }
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<SimulatePricingDTO> => {
    const [{ createSupabaseRepositories }, application, engineMod] =
      await Promise.all([
        import("@/features/pricing/persistence/supabase.server"),
        import("@/features/pricing/application"),
        import("@/features/pricing/engine"),
      ]);

    const repos = createSupabaseRepositories(context.supabase);
    const clock = application.systemClock;
    const ids = application.createIdGenerator();
    const nowIso = clock.nowIso();

    // Leitura de políticas (mesma camada usada pelos Use Cases)
    const companyEnt = await repos.companyPolicies.findByCompany(data.companyId);
    if (!companyEnt) throw new Error("Política da empresa não configurada");

    const categoryEnt = data.categoryId
      ? await repos.categoryPolicies.findByCategory(data.companyId, data.categoryId)
      : null;

    // Canal (preset) — nenhum cálculo novo, apenas contrato ChannelContract.v1
    const channelPreset =
      data.channelId && data.channelId !== "none"
        ? CHANNEL_PRESETS.find((c) => c.id === data.channelId)
        : undefined;
    const channel = channelPreset
      ? {
          channelId: channelPreset.id,
          variableFeePct: channelPreset.variableFeePct,
          fixedFeePerOrderCents: channelPreset.fixedFeePerOrderCents,
          operationalCostCents: channelPreset.operationalCostCents,
          version: engineMod.CHANNEL_CONTRACT_VERSION,
        }
      : undefined;

    // Composição de custo — engine é a fonte única (ver internal/cost.ts).
    // A UI envia apenas componentes brutos; a soma acontece dentro do engine.
    const freight = data.freightCents ?? 0;
    const packaging = data.packagingCents ?? 0;
    const insurance = data.insuranceCents ?? 0;
    const others = data.otherCostsCents ?? 0;

    // MarginTarget — controlado pela UI
    const kind: SimulatorMarginKind = data.marginTarget ?? "ideal";
    const marginTarget: MarginTargetSpec =
      kind === "custom"
        ? { kind: "custom", pct: Number(data.customMarginPct) }
        : { kind };

    // ProductPolicy sintética (simulação — não persiste nada)
    const syntheticProduct = {
      productId: "__simulator__",
    };

    const requestId = ids.next("sim");

    // === Application Layer ports ===
    const bundle = application.defaultResolver.build({
      company: companyEnt.entity,
      category: categoryEnt?.entity,
      product: syntheticProduct,
      channel,
      quantity: data.quantity,
      costComposition: engineMod.composeCostComposition({
        acquisitionCostCents: Math.max(0, data.costCents),
        freightCents: freight,
        packagingCents: packaging,
        insuranceCents: insurance,
        otherExpensesCents: others,
        computedAt: nowIso,
        origin: "manual",
      }),

      contextOverrides: { marginTarget },
      clock: { now: nowIso, tz: "America/Sao_Paulo" },
      requestId,
      requestedBy: { module: "pricing-simulator", userId: context.userId },
      currency: companyEnt.entity.currency,
    });

    const result = application.defaultEngine.compute(bundle.context);
    const explanation = application.defaultEngine.explain(result);

    const originLayer =
      (bundle.resolution.policySource.marginTarget as PolicyLayerName | undefined) ??
      (bundle.resolution.policySource.idealMarginPct as PolicyLayerName | undefined) ??
      (categoryEnt ? "category" : "company");

    const currentPriceCents = data.currentPriceCents ?? null;
    const comparison: SimulatorComparisonDTO | null =
      currentPriceCents != null && currentPriceCents > 0
        ? {
            currentPriceCents,
            recommendedPriceCents: result.finalPriceCents,
            differenceCents: result.finalPriceCents - currentPriceCents,
            differencePct:
              ((result.finalPriceCents - currentPriceCents) / currentPriceCents) *
              100,
            profitImpactCents:
              (result.finalPriceCents - currentPriceCents) * data.quantity,
          }
        : null;

    return {
      currency: result.currency,
      quantity: data.quantity,
      costTotalCents: result.costTotalCents,
      minPriceCents: result.minPriceCents,
      recommendedPriceCents: result.recommendedPriceCents,
      premiumPriceCents: result.premiumPriceCents,
      targetPriceCents: result.targetPriceCents,
      finalPriceCents: result.finalPriceCents,
      grossProfitCents: result.grossProfitCents,
      netProfitCents: result.netProfitCents,
      marginPct: result.marginPct,
      markupPct: result.markupPct,
      originLayer,
      originLabel: ORIGIN_LABEL[originLayer] ?? "Sistema",
      strategyLabel: STRATEGY_LABEL[kind],
      policyVersion: result.policyVersion,
      explainId: result.explainId,
      requestId: result.requestId,
      computedAt: result.computedAt,
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
      comparison,
    };
  });
