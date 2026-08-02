import { describe, expect, it } from "vitest";
import { compute } from "../../engine";
import {
  CHANNEL_CONTRACT_VERSION,
  COST_COMPOSITION_VERSION,
  PRICE_LIST_VERSION,
  TAX_QUOTE_VERSION,
  type ChannelContract,
  type CostComposition,
  type PriceListEntry,
  type TaxQuote,
} from "../../engine/types";
import {
  buildPricingContext,
  mergePolicies,
  resolveCategoryLayer,
  resolveCompanyLayer,
  resolvePriceList,
  resolveProductLayer,
  RESOLUTION_VERSION,
  RESOLVER_VERSION,
  type CategoryPolicy,
  type CompanyPolicy,
  type PricingContextInput,
  type ProductPolicy,
  type ResolverWarningCode,
} from "../index";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const NOW = "2026-07-14T12:00:00.000Z";

const baseCompany = (o: Partial<CompanyPolicy> = {}): CompanyPolicy => ({
  companyId: "co_1",
  currency: "BRL",
  defaults: { minMarginPct: 15, idealMarginPct: 30, premiumMarginPct: 45 },
  ...o,
});

const baseProduct = (o: Partial<ProductPolicy> = {}): ProductPolicy => ({
  productId: "prod_1",
  sku: "SKU-1",
  ...o,
});

const baseCategory = (o: Partial<CategoryPolicy> = {}): CategoryPolicy => ({
  categoryId: "cat_1",
  name: "Bolsas",
  ...o,
});

const baseCost = (): CostComposition => ({
  version: COST_COMPOSITION_VERSION,
  perUnitCostCents: 5000,
  computedAt: NOW,
  origin: "inventory",
});

const baseInput = (o: Partial<PricingContextInput> = {}): PricingContextInput => ({
  company: baseCompany(),
  product: baseProduct(),
  costComposition: baseCost(),
  quantity: 1,
  clock: { now: NOW, tz: "America/Sao_Paulo" },
  requestId: "req_1",
  requestedBy: { module: "test" },
  ...o,
});

const hasWarn = (
  warnings: readonly { code: ResolverWarningCode }[],
  code: ResolverWarningCode,
): boolean => warnings.some((w) => w.code === code);

// ─────────────────────────────────────────────────────────────────────────────
// CompanyPolicyResolver
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveCompanyLayer()", () => {
  it("preserva defaults válidos e não emite warning", () => {
    const layer = resolveCompanyLayer(baseCompany());
    expect(layer.defaults).toEqual({
      minMarginPct: 15,
      idealMarginPct: 30,
      premiumMarginPct: 45,
    });
    expect(layer.warnings).toHaveLength(0);
  });

  it("defaults ausentes → warning MISSING_COMPANY_DEFAULTS e 0/0/0", () => {
    const layer = resolveCompanyLayer(baseCompany({ defaults: undefined }));
    expect(hasWarn(layer.warnings, "MISSING_COMPANY_DEFAULTS")).toBe(true);
    expect(layer.defaults).toEqual({
      minMarginPct: 0,
      idealMarginPct: 0,
      premiumMarginPct: 0,
    });
  });

  it("defaults parciais → warning e zera os ausentes", () => {
    const layer = resolveCompanyLayer(baseCompany({ defaults: { minMarginPct: 10 } }));
    expect(hasWarn(layer.warnings, "MISSING_COMPANY_DEFAULTS")).toBe(true);
    expect(layer.defaults.minMarginPct).toBe(10);
  });

  it("overrides numéricos inválidos são descartados", () => {
    const layer = resolveCompanyLayer(baseCompany({ minMarginPct: NaN, idealMarginPct: 25 }));
    expect(layer.overrides.minMarginPct).toBeUndefined();
    expect(layer.overrides.idealMarginPct).toBe(25);
  });

  it("propaga estratégias ortogonais como overrides", () => {
    const layer = resolveCompanyLayer(
      baseCompany({
        marginTarget: { kind: "ideal" },
        commercialBehavior: { kind: "standard" },
        roundingPolicy: { kind: "end_90" },
      }),
    );
    expect(layer.overrides.marginTarget?.kind).toBe("ideal");
    expect(layer.overrides.commercialBehavior?.kind).toBe("standard");
    expect(layer.overrides.roundingPolicy?.kind).toBe("end_90");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CategoryPolicyResolver
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveCategoryLayer()", () => {
  it("ausente → camada vazia", () => {
    const layer = resolveCategoryLayer(undefined);
    expect(layer.overrides).toEqual({});
    expect(layer.warnings).toHaveLength(0);
    expect(layer.categoryId).toBeUndefined();
  });

  it("propaga overrides definidos", () => {
    const layer = resolveCategoryLayer(
      baseCategory({
        marginTarget: { kind: "custom", pct: 35 },
        minMarginPct: 20,
      }),
    );
    expect(layer.overrides.marginTarget).toEqual({ kind: "custom", pct: 35 });
    expect(layer.overrides.minMarginPct).toBe(20);
  });

  it("descarta números inválidos", () => {
    const layer = resolveCategoryLayer(baseCategory({ idealMarginPct: Number.POSITIVE_INFINITY }));
    expect(layer.overrides.idealMarginPct).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ProductPolicyResolver
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveProductLayer()", () => {
  it("preserva id/sku/priceFloorCents válidos", () => {
    const layer = resolveProductLayer(baseProduct({ priceFloorCents: 12345, sku: "SKU-X" }));
    expect(layer.productId).toBe("prod_1");
    expect(layer.sku).toBe("SKU-X");
    expect(layer.priceFloorCents).toBe(12345);
  });

  it("priceFloor negativo é descartado", () => {
    const layer = resolveProductLayer(baseProduct({ priceFloorCents: -10 }));
    expect(layer.priceFloorCents).toBeUndefined();
  });

  it("aceita priceFloor zero (permitido)", () => {
    const layer = resolveProductLayer(baseProduct({ priceFloorCents: 0 }));
    expect(layer.priceFloorCents).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PolicyMergeResolver — precedência Produto > Categoria > Empresa
// ─────────────────────────────────────────────────────────────────────────────

describe("mergePolicies()", () => {
  const company = resolveCompanyLayer(
    baseCompany({
      marginTarget: { kind: "ideal" },
      roundingPolicy: { kind: "end_90" },
    }),
  );

  it("sem overrides → todos os campos da empresa vencem", () => {
    const cat = resolveCategoryLayer(undefined);
    const prod = resolveProductLayer(baseProduct());
    const m = mergePolicies({ company, category: cat, product: prod });
    expect(m.policySource.marginTarget).toBe("company");
    expect(m.policySource.roundingPolicy).toBe("company");
    // Sem conflito → não emite POLICY_CONFLICT_RESOLVED.
    expect(hasWarn(m.warnings, "POLICY_CONFLICT_RESOLVED")).toBe(false);
  });

  it("categoria sobrescreve empresa e registra conflito", () => {
    const cat = resolveCategoryLayer(baseCategory({ marginTarget: { kind: "premium" } }));
    const prod = resolveProductLayer(baseProduct());
    const m = mergePolicies({ company, category: cat, product: prod });
    expect(m.policySource.marginTarget).toBe("category");
    expect(m.merged.marginTarget).toEqual({ kind: "premium" });
    expect(hasWarn(m.warnings, "POLICY_CONFLICT_RESOLVED")).toBe(true);
    const rule = m.appliedRules.find((r) => r.field === "marginTarget");
    expect(rule?.layer).toBe("category");
    expect(rule?.shadowed).toContain("company");
  });

  it("produto vence categoria e empresa", () => {
    const cat = resolveCategoryLayer(baseCategory({ marginTarget: { kind: "premium" } }));
    const prod = resolveProductLayer(baseProduct({ marginTarget: { kind: "custom", pct: 55 } }));
    const m = mergePolicies({ company, category: cat, product: prod });
    expect(m.policySource.marginTarget).toBe("product");
    expect(m.merged.marginTarget).toEqual({ kind: "custom", pct: 55 });
    const rule = m.appliedRules.find((r) => r.field === "marginTarget");
    expect(rule?.shadowed).toEqual(expect.arrayContaining(["category", "company"]));
  });

  it("contextOverrides vencem tudo (simulador)", () => {
    const cat = resolveCategoryLayer(baseCategory({ marginTarget: { kind: "premium" } }));
    const prod = resolveProductLayer(baseProduct({ marginTarget: { kind: "min" } }));
    const m = mergePolicies({
      company,
      category: cat,
      product: prod,
      contextOverrides: { marginTarget: { kind: "custom", pct: 99 } },
    });
    expect(m.policySource.marginTarget).toBe("context");
    expect(m.merged.marginTarget).toEqual({ kind: "custom", pct: 99 });
  });

  it("campos independentes resolvem em camadas diferentes", () => {
    const cat = resolveCategoryLayer(baseCategory({ roundingPolicy: { kind: "end_99" } }));
    const prod = resolveProductLayer(
      baseProduct({ commercialBehavior: { kind: "high_turnover" } }),
    );
    const m = mergePolicies({ company, category: cat, product: prod });
    expect(m.policySource.marginTarget).toBe("company");
    expect(m.policySource.roundingPolicy).toBe("category");
    expect(m.policySource.commercialBehavior).toBe("product");
  });

  it("campo não definido em lugar algum → source = system", () => {
    const emptyCompany = resolveCompanyLayer(baseCompany({}));
    const m = mergePolicies({
      company: emptyCompany,
      category: resolveCategoryLayer(undefined),
      product: resolveProductLayer(baseProduct()),
    });
    expect(m.policySource.marginTarget).toBe("system");
    expect(m.merged.marginTarget).toBeUndefined();
  });

  it("override silencioso (só produto) emite POLICY_OVERRIDE_APPLIED", () => {
    const emptyCompany = resolveCompanyLayer(baseCompany({}));
    const prod = resolveProductLayer(
      baseProduct({ commercialBehavior: { kind: "promotion", discountPct: 5 } }),
    );
    const m = mergePolicies({
      company: emptyCompany,
      category: resolveCategoryLayer(undefined),
      product: prod,
    });
    expect(hasWarn(m.warnings, "POLICY_OVERRIDE_APPLIED")).toBe(true);
  });

  it("contextOverrides vazio não vira camada", () => {
    const m = mergePolicies({
      company,
      category: resolveCategoryLayer(undefined),
      product: resolveProductLayer(baseProduct()),
      contextOverrides: {},
    });
    expect(Object.values(m.policySource)).not.toContain("context");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PriceListResolver
// ─────────────────────────────────────────────────────────────────────────────

describe("resolvePriceList()", () => {
  const entry = (o: Partial<PriceListEntry> = {}): PriceListEntry => ({
    version: PRICE_LIST_VERSION,
    priceListId: "pl_1",
    productId: "prod_1",
    priceCents: 9990,
    currency: "BRL",
    fallback: "derived",
    ...o,
  });

  it("sem candidatas → derived", () => {
    const r = resolvePriceList({
      productId: "prod_1",
      currency: "BRL",
      quantity: 1,
    });
    expect(r.mode).toBe("derived");
    expect(r.selected).toBeUndefined();
  });

  it("candidata aplicável → tabled", () => {
    const r = resolvePriceList({
      candidates: [entry()],
      productId: "prod_1",
      currency: "BRL",
      quantity: 1,
    });
    expect(r.mode).toBe("tabled");
    expect(r.selected?.priceListId).toBe("pl_1");
  });

  it("filtro por productId descarta entries de outro produto", () => {
    const r = resolvePriceList({
      candidates: [entry({ productId: "outro" })],
      productId: "prod_1",
      currency: "BRL",
      quantity: 1,
    });
    expect(r.mode).toBe("derived");
  });

  it("currency mismatch → warning e descarta", () => {
    const r = resolvePriceList({
      candidates: [entry({ currency: "USD" })],
      productId: "prod_1",
      currency: "BRL",
      quantity: 1,
    });
    expect(hasWarn(r.warnings, "PRICE_LIST_CURRENCY_MISMATCH")).toBe(true);
    expect(r.mode).toBe("derived");
  });

  it("qty fora de range → warning e derived", () => {
    const r = resolvePriceList({
      candidates: [entry({ minQty: 10, maxQty: 20 })],
      productId: "prod_1",
      currency: "BRL",
      quantity: 1,
    });
    expect(hasWarn(r.warnings, "PRICE_LIST_NOT_APPLICABLE")).toBe(true);
    expect(r.mode).toBe("derived");
  });

  it("prioridade DESC vence", () => {
    const r = resolvePriceList({
      candidates: [
        entry({ priceListId: "low", priority: 1, priceCents: 5000 }),
        entry({ priceListId: "high", priority: 9, priceCents: 8000 }),
      ],
      productId: "prod_1",
      currency: "BRL",
      quantity: 1,
    });
    expect(r.selected?.priceListId).toBe("high");
    expect(hasWarn(r.warnings, "PRICE_LIST_MULTIPLE_CANDIDATES")).toBe(true);
  });

  it("empate em prioridade → menor priceCents", () => {
    const r = resolvePriceList({
      candidates: [
        entry({ priceListId: "a", priority: 5, priceCents: 8000 }),
        entry({ priceListId: "b", priority: 5, priceCents: 6000 }),
      ],
      productId: "prod_1",
      currency: "BRL",
      quantity: 1,
    });
    expect(r.selected?.priceListId).toBe("b");
  });

  it("prioridade ausente é tratada como 0", () => {
    const r = resolvePriceList({
      candidates: [entry({ priceListId: "sem" }), entry({ priceListId: "com", priority: 3 })],
      productId: "prod_1",
      currency: "BRL",
      quantity: 1,
    });
    expect(r.selected?.priceListId).toBe("com");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PricingContextFactory — integração resolver → contexto
// ─────────────────────────────────────────────────────────────────────────────

describe("buildPricingContext()", () => {
  it("monta contexto v1 válido com defaults da empresa", () => {
    const { context, resolution } = buildPricingContext(baseInput());
    expect(context.contextVersion).toBe("pricing-context/1");
    expect(context.company.currency).toBe("BRL");
    expect(context.company.defaults).toEqual({
      minMarginPct: 15,
      idealMarginPct: 30,
      premiumMarginPct: 45,
    });
    expect(resolution.resolverVersion).toBe(RESOLVER_VERSION);
    expect(resolution.resolutionVersion).toBe(RESOLUTION_VERSION);
    expect(resolution.pricingMode).toBe("derived");
  });

  it("currency explícita no input sobrescreve currency da empresa", () => {
    const { context, resolution } = buildPricingContext(baseInput({ currency: "USD" }));
    expect(context.currency).toBe("USD");
    expect(resolution.policySource.currency).toBe("context");
  });

  it("produto sem categoria → context.category undefined", () => {
    const { context } = buildPricingContext(baseInput());
    expect(context.category).toBeUndefined();
  });

  it("categoria presente → context.category populada", () => {
    const { context } = buildPricingContext(baseInput({ category: baseCategory() }));
    expect(context.category?.id).toBe("cat_1");
    expect(context.category?.name).toBe("Bolsas");
  });

  it("herança: min/ideal/premium do produto sobrescrevem defaults da empresa", () => {
    const { context, resolution } = buildPricingContext(
      baseInput({
        product: baseProduct({
          minMarginPct: 25,
          idealMarginPct: 40,
          premiumMarginPct: 60,
        }),
      }),
    );
    expect(context.company.defaults).toEqual({
      minMarginPct: 25,
      idealMarginPct: 40,
      premiumMarginPct: 60,
    });
    expect(resolution.policySource.minMarginPct).toBe("product");
  });

  it("categoria sobrescreve empresa, produto sobrescreve categoria (min)", () => {
    const { context } = buildPricingContext(
      baseInput({
        category: baseCategory({ minMarginPct: 20 }),
        product: baseProduct({ minMarginPct: 33 }),
      }),
    );
    expect(context.company.defaults?.minMarginPct).toBe(33);
  });

  it("priceList aplicável → context.priceList presente e modo tabled", () => {
    const priceList: PriceListEntry = {
      version: PRICE_LIST_VERSION,
      priceListId: "pl_1",
      productId: "prod_1",
      priceCents: 9990,
      currency: "BRL",
      fallback: "derived",
    };
    const { context, resolution } = buildPricingContext(
      baseInput({ priceListCandidates: [priceList] }),
    );
    expect(context.priceList?.priceListId).toBe("pl_1");
    expect(resolution.pricingMode).toBe("tabled");
    expect(resolution.policySource.priceList).toBe("context");
  });

  it("priceList com currency divergente → derived e sem context.priceList", () => {
    const priceList: PriceListEntry = {
      version: PRICE_LIST_VERSION,
      priceListId: "pl_x",
      productId: "prod_1",
      priceCents: 9990,
      currency: "USD",
      fallback: "derived",
    };
    const { context, resolution } = buildPricingContext(
      baseInput({ priceListCandidates: [priceList] }),
    );
    expect(context.priceList).toBeUndefined();
    expect(resolution.pricingMode).toBe("derived");
  });

  it("channel repassado como snapshot opaco", () => {
    const channel: ChannelContract = {
      channelId: "ml",
      variableFeePct: 12,
      fixedFeePerOrderCents: 0,
      operationalCostCents: 0,
      version: CHANNEL_CONTRACT_VERSION,
    };
    const { context } = buildPricingContext(baseInput({ channel }));
    expect(context.channel).toBe(channel);
  });

  it("taxQuote repassado como snapshot opaco", () => {
    const taxQuote: TaxQuote = {
      version: TAX_QUOTE_VERSION,
      quoteId: "tq_1",
      totalPctOnPrice: 10,
      totalFixedCents: 0,
      taxEngineVersion: "tax-engine/1.0.0",
    };
    const { context } = buildPricingContext(baseInput({ taxQuote }));
    expect(context.taxQuote?.quoteId).toBe("tq_1");
  });

  it("costComposition ausente → warning MISSING_COST_COMPOSITION", () => {
    const input = baseInput();
    // Simula caller que perdeu o dado — bypass explícito.
    const broken = { ...input, costComposition: undefined as unknown as CostComposition };
    const { resolution } = buildPricingContext(broken);
    expect(hasWarn(resolution.warnings, "MISSING_COST_COMPOSITION")).toBe(true);
  });

  it("contextOverrides.marginTarget vence produto/categoria/empresa", () => {
    const { context, resolution } = buildPricingContext(
      baseInput({
        product: baseProduct({ marginTarget: { kind: "premium" } }),
        contextOverrides: { marginTarget: { kind: "custom", pct: 42 } },
      }),
    );
    expect(context.marginTarget).toEqual({ kind: "custom", pct: 42 });
    expect(resolution.policySource.marginTarget).toBe("context");
  });

  it("priceFloorCents do produto vira product.priceFloorCents no contexto", () => {
    const { context, resolution } = buildPricingContext(
      baseInput({ product: baseProduct({ priceFloorCents: 8000 }) }),
    );
    expect(context.product.priceFloorCents).toBe(8000);
    expect(resolution.policySource.priceFloor).toBe("product");
  });

  it("policySource inclui campos não-políticos rastreáveis", () => {
    const { resolution } = buildPricingContext(baseInput());
    expect(resolution.policySource.currency).toBeDefined();
    expect(resolution.policySource.priceList).toBe("system");
    expect(resolution.policySource.channel).toBe("system");
    expect(resolution.policySource.taxQuote).toBe("system");
    expect(resolution.policySource.costComposition).toBe("context");
  });

  it("warnings do resolver não vazam para o Core", () => {
    const { context, resolution } = buildPricingContext(
      baseInput({ company: baseCompany({ defaults: undefined }) }),
    );
    expect(hasWarn(resolution.warnings, "MISSING_COMPANY_DEFAULTS")).toBe(true);
    // O contexto entregue ao Core não carrega warnings do resolver.
    expect((context as unknown as { warnings?: unknown }).warnings).toBeUndefined();
  });

  it("nunca lança para inputs esperados/anômalos", () => {
    const cases: PricingContextInput[] = [
      baseInput(),
      baseInput({ quantity: -1 }),
      baseInput({ company: baseCompany({ defaults: undefined }) }),
      baseInput({
        product: baseProduct({ marginTarget: { kind: "custom", pct: 500 } }),
      }),
    ];
    for (const c of cases) {
      expect(() => buildPricingContext(c)).not.toThrow();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integração: resolver → Core (contrato preservado)
// ─────────────────────────────────────────────────────────────────────────────

describe("integração resolver → compute()", () => {
  it("contexto montado pelo resolver é aceito pelo Core sem alteração", () => {
    const { context } = buildPricingContext(baseInput());
    const result = compute(context);
    // Custo 5000, ideal 30% => 5000/0.7 = 7142.85 → 7143
    expect(result.recommendedPriceCents).toBe(7143);
    expect(result.mode).toBe("derived");
  });

  it("modo tabled propagado corretamente ao Core", () => {
    const priceList: PriceListEntry = {
      version: PRICE_LIST_VERSION,
      priceListId: "pl_int",
      productId: "prod_1",
      priceCents: 12345,
      currency: "BRL",
      fallback: "derived",
    };
    const { context } = buildPricingContext(baseInput({ priceListCandidates: [priceList] }));
    const result = compute(context);
    expect(result.mode).toBe("tabled");
    expect(result.finalPriceCents).toBe(12345);
  });

  it("override de produto (custom 50%) reflete no cálculo do Core", () => {
    const { context } = buildPricingContext(
      baseInput({
        product: baseProduct({ marginTarget: { kind: "custom", pct: 50 } }),
      }),
    );
    const result = compute(context);
    // 5000 / 0.5 = 10000
    expect(result.targetPriceCents).toBe(10000);
  });
});
