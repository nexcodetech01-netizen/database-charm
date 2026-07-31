import { describe, expect, it } from "vitest";
import {
  CHANNEL_CONTRACT_VERSION,
  COST_COMPOSITION_VERSION,
  PRICE_LIST_VERSION,
  TAX_QUOTE_VERSION,
} from "../../engine/types";
import {
  CONFIG_DOMAIN_VERSION,
  DomainValidationError,
  PRICE_LIST_AGGREGATE_VERSION,
  createCategoryPolicy,
  createChannelContract,
  createCompanyPolicy,
  createCostComposition,
  createHighTurnover,
  createMarginTarget,
  createPriceList,
  createPriceListEntry,
  createProductPolicy,
  createPromotion,
  createPsychologicalRounding,
  createRoundingEnd90,
  createRoundingEnd99,
  createRoundingInteger,
  createRoundingNone,
  createStandard,
  createStockBurn,
  createTaxQuote,
  fromEnvelope,
  fromJSON,
  isMarginTargetSpec,
  okResult,
  throwIfInvalid,
  toEnvelope,
  toJSON,
  toResult,
  validateCategoryPolicy,
  validateChannelContract,
  validateCommercialBehavior,
  validateCompanyPolicy,
  validateCostComposition,
  validateMarginTarget,
  validatePriceList,
  validatePriceListEntry,
  validateProductPolicy,
  validateRoundingPolicy,
  validateTaxQuote,
} from "../index";

const NOW = "2026-07-14T12:00:00.000Z";

// ─── errors / result helpers ─────────────────────────────────────────────────
describe("result helpers", () => {
  it("okResult é sempre ok e sem issues", () => {
    expect(okResult.ok).toBe(true);
    expect(okResult.issues).toEqual([]);
  });
  it("toResult marca ok=false quando há erro", () => {
    const r = toResult([
      { code: "REQUIRED_FIELD", message: "x", path: "p", severity: "error" },
    ]);
    expect(r.ok).toBe(false);
  });
  it("toResult ignora warnings para status", () => {
    const r = toResult([
      { code: "MARGIN_INCONSISTENT", message: "x", path: "p", severity: "warning" },
    ]);
    expect(r.ok).toBe(true);
  });
  it("throwIfInvalid lança DomainValidationError com issues", () => {
    try {
      throwIfInvalid(
        toResult([
          { code: "REQUIRED_FIELD", message: "x", path: "p", severity: "error" },
        ]),
      );
      expect.fail("deveria lançar");
    } catch (e) {
      expect(e).toBeInstanceOf(DomainValidationError);
      expect((e as DomainValidationError).issues).toHaveLength(1);
      expect((e as DomainValidationError).message).toMatch(/1 issue/);
    }
  });
  it("throwIfInvalid não lança quando ok", () => {
    expect(() => throwIfInvalid(okResult)).not.toThrow();
  });
  it("DomainValidationError pluraliza mensagem", () => {
    const err = new DomainValidationError([
      { code: "REQUIRED_FIELD", message: "a", path: "p1", severity: "error" },
      { code: "REQUIRED_FIELD", message: "b", path: "p2", severity: "error" },
    ]);
    expect(err.message).toMatch(/2 issues/);
    expect(err.name).toBe("DomainValidationError");
  });
});

// ─── MarginTarget ────────────────────────────────────────────────────────────
describe("MarginTarget", () => {
  it("cria variantes fixas", () => {
    expect(createMarginTarget("min")).toEqual({ kind: "min" });
    expect(createMarginTarget("ideal")).toEqual({ kind: "ideal" });
    expect(createMarginTarget("premium")).toEqual({ kind: "premium" });
  });
  it("cria custom com pct", () => {
    expect(createMarginTarget("custom", 42)).toEqual({ kind: "custom", pct: 42 });
  });
  it("custom sem pct lança", () => {
    expect(() => createMarginTarget("custom", NaN)).toThrow();
    expect(() => createMarginTarget("custom", undefined as unknown as number)).toThrow();
  });
  it("valida ausência como no-op", () => {
    expect(validateMarginTarget(undefined)).toEqual([]);
    expect(validateMarginTarget(null)).toEqual([]);
  });
  it("rejeita não-objeto", () => {
    expect(validateMarginTarget("x")[0].code).toBe("INVALID_TYPE");
  });
  it("rejeita kind desconhecido", () => {
    expect(validateMarginTarget({ kind: "boom" })[0].code).toBe("INVALID_ENUM");
  });
  it("rejeita custom com pct inválido", () => {
    expect(validateMarginTarget({ kind: "custom", pct: "x" })[0].code).toBe("INVALID_NUMBER");
    expect(validateMarginTarget({ kind: "custom", pct: 999 })[0].code).toBe("OUT_OF_RANGE");
  });
  it("isMarginTargetSpec discrimina", () => {
    expect(isMarginTargetSpec({ kind: "ideal" })).toBe(true);
    expect(isMarginTargetSpec({ kind: "x" })).toBe(false);
    expect(isMarginTargetSpec(null)).toBe(false);
  });
});

// ─── CommercialBehavior ──────────────────────────────────────────────────────
describe("CommercialBehavior", () => {
  it("factories básicas", () => {
    expect(createStandard()).toEqual({ kind: "standard" });
    expect(createHighTurnover()).toEqual({ kind: "high_turnover", discountPct: undefined });
    expect(createHighTurnover(5)).toEqual({ kind: "high_turnover", discountPct: 5 });
    expect(createPromotion(10)).toEqual({ kind: "promotion", discountPct: 10 });
    expect(createStockBurn(20)).toEqual({ kind: "stock_burn", maxDiscountPct: 20 });
  });
  it("factories rejeitam pct inválido", () => {
    expect(() => createHighTurnover(NaN)).toThrow();
    expect(() => createPromotion(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => createStockBurn(NaN)).toThrow();
  });
  it("validação ausente = no-op", () => {
    expect(validateCommercialBehavior(undefined)).toEqual([]);
    expect(validateCommercialBehavior(null)).toEqual([]);
  });
  it("rejeita não-objeto", () => {
    expect(validateCommercialBehavior("x")[0].code).toBe("INVALID_TYPE");
  });
  it("rejeita kind desconhecido", () => {
    expect(validateCommercialBehavior({ kind: "x" })[0].code).toBe(
      "INVALID_COMMERCIAL_BEHAVIOR",
    );
  });
  it("valida standard sem campos", () => {
    expect(validateCommercialBehavior({ kind: "standard" })).toEqual([]);
  });
  it("promotion sem discountPct falha", () => {
    expect(validateCommercialBehavior({ kind: "promotion" }).length).toBeGreaterThan(0);
  });
  it("stock_burn valida maxDiscountPct", () => {
    expect(validateCommercialBehavior({ kind: "stock_burn", maxDiscountPct: 150 }).length).toBeGreaterThan(0);
  });
  it("high_turnover opcional aceita e valida pct", () => {
    expect(validateCommercialBehavior({ kind: "high_turnover" })).toEqual([]);
    expect(validateCommercialBehavior({ kind: "high_turnover", discountPct: 200 }).length).toBeGreaterThan(0);
  });
});

// ─── RoundingPolicy ──────────────────────────────────────────────────────────
describe("RoundingPolicy", () => {
  it("factories", () => {
    expect(createRoundingNone().kind).toBe("none");
    expect(createRoundingInteger().kind).toBe("integer");
    expect(createRoundingEnd90().kind).toBe("end_90");
    expect(createRoundingEnd99().kind).toBe("end_99");
    expect(createPsychologicalRounding([99, 90])).toEqual({
      kind: "psychological",
      endings: [99, 90],
    });
  });
  it("psychological vazio rejeita", () => {
    expect(() => createPsychologicalRounding([])).toThrow();
    expect(() => createPsychologicalRounding(undefined as unknown as number[])).toThrow();
  });
  it("valida ausência", () => {
    expect(validateRoundingPolicy(undefined)).toEqual([]);
    expect(validateRoundingPolicy(null)).toEqual([]);
  });
  it("rejeita não-objeto", () => {
    expect(validateRoundingPolicy("x")[0].code).toBe("INVALID_TYPE");
  });
  it("rejeita kind desconhecido", () => {
    expect(validateRoundingPolicy({ kind: "x" })[0].code).toBe("INVALID_ROUNDING_POLICY");
  });
  it("aceita variantes válidas", () => {
    expect(validateRoundingPolicy({ kind: "end_90" })).toEqual([]);
    expect(validateRoundingPolicy({ kind: "integer" })).toEqual([]);
  });
  it("psychological exige endings válidos", () => {
    expect(validateRoundingPolicy({ kind: "psychological" })[0].code).toBe("INVALID_ROUNDING_POLICY");
    expect(validateRoundingPolicy({ kind: "psychological", endings: [] })[0].code).toBe(
      "INVALID_ROUNDING_POLICY",
    );
    expect(validateRoundingPolicy({ kind: "psychological", endings: [100] })[0].code).toBe(
      "INVALID_ROUNDING_POLICY",
    );
    expect(validateRoundingPolicy({ kind: "psychological", endings: [-1] })[0].code).toBe(
      "INVALID_ROUNDING_POLICY",
    );
    expect(validateRoundingPolicy({ kind: "psychological", endings: [0, 99] })).toEqual([]);
  });
});

// ─── CostComposition ─────────────────────────────────────────────────────────
describe("CostComposition", () => {
  it("cria com defaults corretos", () => {
    const c = createCostComposition({
      perUnitCostCents: 1000,
      computedAt: NOW,
      origin: "inventory",
    });
    expect(c.version).toBe(COST_COMPOSITION_VERSION);
    expect(c.perUnitCostCents).toBe(1000);
  });
  it("rejeita não-objeto", () => {
    expect(validateCostComposition(null)[0].code).toBe("INVALID_TYPE");
  });
  it("rejeita versão errada", () => {
    const c = createCostComposition({ perUnitCostCents: 1000, computedAt: NOW });
    expect(validateCostComposition({ ...c, version: "old" })[0].code).toBe(
      "UNSUPPORTED_CONFIG_VERSION",
    );
  });
  it("rejeita perUnitCost negativo", () => {
    const c = createCostComposition({ perUnitCostCents: -1, computedAt: NOW });
    const issues = validateCostComposition(c);
    expect(issues.some((i) => i.code === "NEGATIVE_COST")).toBe(true);
  });
  it("rejeita perUnitCost não inteiro", () => {
    const c = createCostComposition({ perUnitCostCents: 1.5, computedAt: NOW });
    expect(validateCostComposition(c).some((i) => i.code === "INVALID_NUMBER")).toBe(true);
  });
  it("rejeita computedAt inválido", () => {
    const c = createCostComposition({ perUnitCostCents: 1000, computedAt: "abc" });
    expect(validateCostComposition(c).some((i) => i.code === "INVALID_ISO_DATE")).toBe(true);
  });
  it("origin inválida", () => {
    const c = createCostComposition({ perUnitCostCents: 1000, computedAt: NOW });
    expect(
      validateCostComposition({ ...c, origin: "bogus" as unknown as "inventory" })
        .some((i) => i.code === "INVALID_ENUM"),
    ).toBe(true);
  });
  it("staleThresholdDays negativa falha", () => {
    const c = createCostComposition({
      perUnitCostCents: 1000,
      computedAt: NOW,
      staleThresholdDays: -5,
    });
    expect(validateCostComposition(c).some((i) => i.code === "OUT_OF_RANGE")).toBe(true);
  });
  it("componentes ausentes = ok", () => {
    const c = createCostComposition({ perUnitCostCents: 1000, computedAt: NOW });
    expect(validateCostComposition(c)).toEqual([]);
  });
  it("soma dos componentes deve bater com perUnit", () => {
    const c = createCostComposition({
      perUnitCostCents: 1500,
      acquisitionCostCents: 1000,
      freightCents: 200,
      insuranceCents: 100,
      packagingCents: 100,
      otherExpensesCents: 100,
      computedAt: NOW,
    });
    expect(validateCostComposition(c).every((i) => i.code !== "COST_COMPONENTS_MISMATCH")).toBe(true);
  });
  it("soma incorreta gera COST_COMPONENTS_MISMATCH", () => {
    const c = createCostComposition({
      perUnitCostCents: 999,
      acquisitionCostCents: 500,
      freightCents: 100,
      computedAt: NOW,
    });
    expect(validateCostComposition(c).some((i) => i.code === "COST_COMPONENTS_MISMATCH")).toBe(true);
  });
});

// ─── ChannelContract ─────────────────────────────────────────────────────────
describe("ChannelContract", () => {
  const base = () =>
    createChannelContract({
      channelId: "ml",
      variableFeePct: 12,
      fixedFeePerOrderCents: 300,
      operationalCostCents: 100,
    });
  it("cria com versão", () => {
    expect(base().version).toBe(CHANNEL_CONTRACT_VERSION);
  });
  it("rejeita não-objeto", () => {
    expect(validateChannelContract(42)[0].code).toBe("INVALID_TYPE");
  });
  it("rejeita versão errada", () => {
    expect(
      validateChannelContract({ ...base(), version: "x" }).some(
        (i) => i.code === "UNSUPPORTED_CONFIG_VERSION",
      ),
    ).toBe(true);
  });
  it("channelId obrigatório", () => {
    expect(
      validateChannelContract({ ...base(), channelId: "" }).some(
        (i) => i.code === "REQUIRED_FIELD",
      ),
    ).toBe(true);
  });
  it("variableFeePct fora de range", () => {
    expect(
      validateChannelContract({ ...base(), variableFeePct: 150 }).some(
        (i) => i.code === "CHANNEL_FEE_OUT_OF_RANGE",
      ),
    ).toBe(true);
  });
  it("variableFeePct não numérico", () => {
    expect(
      validateChannelContract({ ...base(), variableFeePct: "x" as unknown as number }).some(
        (i) => i.code === "INVALID_NUMBER",
      ),
    ).toBe(true);
  });
  it("centavos negativos", () => {
    expect(
      validateChannelContract({ ...base(), fixedFeePerOrderCents: -1 }).some(
        (i) => i.code === "NEGATIVE_COST",
      ),
    ).toBe(true);
  });
  it("hasNonLinearRules deve ser boolean", () => {
    expect(
      validateChannelContract({
        ...base(),
        hasNonLinearRules: "yes" as unknown as boolean,
      }).some((i) => i.code === "INVALID_TYPE"),
    ).toBe(true);
  });
  it("minMarginOverridePct valida faixa", () => {
    expect(
      validateChannelContract({ ...base(), minMarginOverridePct: 500 }).some(
        (i) => i.code === "OUT_OF_RANGE",
      ),
    ).toBe(true);
  });
  it("válido = zero issues", () => {
    expect(validateChannelContract(base())).toEqual([]);
  });
});

// ─── TaxQuote ────────────────────────────────────────────────────────────────
describe("TaxQuote", () => {
  const base = () =>
    createTaxQuote({
      quoteId: "q1",
      totalPctOnPrice: 10,
      totalFixedCents: 0,
      taxEngineVersion: "tax-engine/1.0.0",
    });
  it("cria com versão", () => {
    expect(base().version).toBe(TAX_QUOTE_VERSION);
  });
  it("rejeita não-objeto", () => {
    expect(validateTaxQuote(null)[0].code).toBe("INVALID_TYPE");
  });
  it("versão errada", () => {
    expect(
      validateTaxQuote({ ...base(), version: "x" }).some(
        (i) => i.code === "UNSUPPORTED_CONFIG_VERSION",
      ),
    ).toBe(true);
  });
  it("quoteId obrigatório", () => {
    expect(
      validateTaxQuote({ ...base(), quoteId: "" }).some((i) => i.code === "REQUIRED_FIELD"),
    ).toBe(true);
  });
  it("totalPctOnPrice não numérico", () => {
    expect(
      validateTaxQuote({ ...base(), totalPctOnPrice: "x" as unknown as number }).some(
        (i) => i.code === "INVALID_NUMBER",
      ),
    ).toBe(true);
  });
  it("totalPctOnPrice fora de faixa", () => {
    expect(
      validateTaxQuote({ ...base(), totalPctOnPrice: 200 }).some(
        (i) => i.code === "OUT_OF_RANGE",
      ),
    ).toBe(true);
  });
  it("validTo antes de validFrom", () => {
    const issues = validateTaxQuote({
      ...base(),
      validFrom: "2026-07-14T00:00:00.000Z",
      validTo: "2026-07-13T00:00:00.000Z",
    });
    expect(issues.some((i) => i.code === "OUT_OF_RANGE")).toBe(true);
  });
  it("validFrom inválido", () => {
    expect(
      validateTaxQuote({ ...base(), validFrom: "not-a-date" }).some(
        (i) => i.code === "INVALID_ISO_DATE",
      ),
    ).toBe(true);
  });
  it("validTo inválido", () => {
    expect(
      validateTaxQuote({ ...base(), validTo: "not-a-date" }).some(
        (i) => i.code === "INVALID_ISO_DATE",
      ),
    ).toBe(true);
  });
  it("válido = sem issues", () => {
    expect(validateTaxQuote(base())).toEqual([]);
  });
});

// ─── PriceList ───────────────────────────────────────────────────────────────
describe("PriceList", () => {
  const entry = (o: Partial<Parameters<typeof createPriceListEntry>[1]> = {}) =>
    createPriceListEntry("pl_1", {
      productId: "prod_1",
      priceCents: 9990,
      currency: "BRL",
      ...o,
    });

  it("createPriceListEntry aplica fallback default", () => {
    const e = entry();
    expect(e.version).toBe(PRICE_LIST_VERSION);
    expect(e.fallback).toBe("derived");
  });

  it("createPriceList monta agregado com versão", () => {
    const pl = createPriceList({
      priceListId: "pl_1",
      currency: "BRL",
      entries: [{ productId: "p1", priceCents: 1000, currency: "BRL" }],
    });
    expect(pl.version).toBe(PRICE_LIST_AGGREGATE_VERSION);
    expect(pl.priority).toBe(0);
    expect(pl.entries[0].fallback).toBe("derived");
  });

  it("createPriceList aplica prioridade herdada às entries", () => {
    const pl = createPriceList({
      priceListId: "pl_2",
      currency: "BRL",
      priority: 5,
      entries: [{ productId: "p1", priceCents: 1000, currency: "BRL" }],
    });
    expect(pl.entries[0].priority).toBe(5);
  });

  it("valida entry: rejeita não-objeto", () => {
    expect(validatePriceListEntry(null)[0].code).toBe("INVALID_TYPE");
  });
  it("valida entry: versão errada", () => {
    expect(
      validatePriceListEntry({ ...entry(), version: "old" }).some(
        (i) => i.code === "UNSUPPORTED_CONFIG_VERSION",
      ),
    ).toBe(true);
  });
  it("valida entry: fallback inválido", () => {
    expect(
      validatePriceListEntry({ ...entry(), fallback: "boom" }).some(
        (i) => i.code === "INVALID_ENUM",
      ),
    ).toBe(true);
  });
  it("valida entry: minQty negativa", () => {
    expect(
      validatePriceListEntry({ ...entry(), minQty: -1 }).some(
        (i) => i.code === "OUT_OF_RANGE",
      ),
    ).toBe(true);
  });
  it("valida entry: maxQty ≤ 0", () => {
    expect(
      validatePriceListEntry({ ...entry(), maxQty: 0 }).some(
        (i) => i.code === "OUT_OF_RANGE",
      ),
    ).toBe(true);
  });
  it("valida entry: maxQty < minQty", () => {
    expect(
      validatePriceListEntry({ ...entry(), minQty: 10, maxQty: 5 }).some(
        (i) => i.code === "PRICE_LIST_RANGE_INVALID",
      ),
    ).toBe(true);
  });
  it("valida entry: currency inválida", () => {
    expect(
      validatePriceListEntry({ ...entry(), currency: "reais" }).some(
        (i) => i.code === "INVALID_CURRENCY",
      ),
    ).toBe(true);
  });

  it("aggregate rejeita entries vazias", () => {
    const pl = createPriceList({
      priceListId: "pl_x",
      currency: "BRL",
      entries: [],
    });
    expect(validatePriceList(pl).some((i) => i.code === "PRICE_LIST_EMPTY")).toBe(true);
  });
  it("aggregate rejeita não-objeto", () => {
    expect(validatePriceList("x")[0].code).toBe("INVALID_TYPE");
  });
  it("aggregate rejeita versão errada", () => {
    const pl = createPriceList({
      priceListId: "pl_1",
      currency: "BRL",
      entries: [{ productId: "p1", priceCents: 1000, currency: "BRL" }],
    });
    expect(
      validatePriceList({ ...pl, version: "x" }).some(
        (i) => i.code === "UNSUPPORTED_CONFIG_VERSION",
      ),
    ).toBe(true);
  });
  it("aggregate detecta currency mix", () => {
    const pl = createPriceList({
      priceListId: "pl_1",
      currency: "BRL",
      entries: [
        { productId: "p1", priceCents: 1000, currency: "BRL" },
        { productId: "p2", priceCents: 2000, currency: "USD" },
      ],
    });
    expect(validatePriceList(pl).some((i) => i.code === "PRICE_LIST_CURRENCY_MIX")).toBe(true);
  });
  it("aggregate detecta sobreposição de faixas", () => {
    const pl = createPriceList({
      priceListId: "pl_1",
      currency: "BRL",
      entries: [
        { productId: "p1", priceCents: 1000, currency: "BRL", minQty: 1, maxQty: 10 },
        { productId: "p1", priceCents: 900, currency: "BRL", minQty: 5, maxQty: 20 },
      ],
    });
    expect(validatePriceList(pl).some((i) => i.code === "PRICE_LIST_RANGE_OVERLAP")).toBe(true);
  });
  it("aggregate aceita faixas contíguas do mesmo produto sem overlap", () => {
    const pl = createPriceList({
      priceListId: "pl_1",
      currency: "BRL",
      entries: [
        { productId: "p1", priceCents: 1000, currency: "BRL", minQty: 1, maxQty: 4 },
        { productId: "p1", priceCents: 900, currency: "BRL", minQty: 5, maxQty: 20 },
      ],
    });
    expect(validatePriceList(pl).every((i) => i.code !== "PRICE_LIST_RANGE_OVERLAP")).toBe(true);
  });
  it("aggregate aceita produtos distintos com mesma faixa", () => {
    const pl = createPriceList({
      priceListId: "pl_1",
      currency: "BRL",
      entries: [
        { productId: "p1", priceCents: 1000, currency: "BRL", minQty: 1 },
        { productId: "p2", priceCents: 1500, currency: "BRL", minQty: 1 },
      ],
    });
    expect(validatePriceList(pl)).toEqual([]);
  });
});

// ─── CompanyPolicy ───────────────────────────────────────────────────────────
describe("CompanyPolicy", () => {
  const base = () =>
    createCompanyPolicy({
      companyId: "co_1",
      currency: "BRL",
      defaults: { minMarginPct: 10, idealMarginPct: 20, premiumMarginPct: 30 },
    });
  it("cria e valida sem issues", () => {
    expect(validateCompanyPolicy(base())).toEqual([]);
  });
  it("rejeita não-objeto", () => {
    expect(validateCompanyPolicy(null)[0].code).toBe("INVALID_TYPE");
  });
  it("companyId obrigatório", () => {
    expect(
      validateCompanyPolicy({ ...base(), companyId: "" }).some(
        (i) => i.code === "REQUIRED_FIELD",
      ),
    ).toBe(true);
  });
  it("currency inválida", () => {
    expect(
      validateCompanyPolicy({ ...base(), currency: "brl" }).some(
        (i) => i.code === "INVALID_CURRENCY",
      ),
    ).toBe(true);
  });
  it("defaults não objeto → INVALID_TYPE", () => {
    expect(
      validateCompanyPolicy({ ...base(), defaults: 42 as unknown as object }).some(
        (i) => i.code === "INVALID_TYPE",
      ),
    ).toBe(true);
  });
  it("defaults inconsistentes (min > ideal)", () => {
    const c = createCompanyPolicy({
      companyId: "co_1",
      currency: "BRL",
      defaults: { minMarginPct: 30, idealMarginPct: 20, premiumMarginPct: 40 },
    });
    expect(validateCompanyPolicy(c).some((i) => i.code === "MARGIN_INCONSISTENT")).toBe(true);
  });
  it("defaults inconsistentes (ideal > premium)", () => {
    const c = createCompanyPolicy({
      companyId: "co_1",
      currency: "BRL",
      defaults: { minMarginPct: 10, idealMarginPct: 50, premiumMarginPct: 20 },
    });
    expect(validateCompanyPolicy(c).some((i) => i.code === "MARGIN_INCONSISTENT")).toBe(true);
  });
  it("overrides no nível empresa também validam coerência", () => {
    const c = createCompanyPolicy({
      companyId: "co_1",
      currency: "BRL",
      minMarginPct: 40,
      idealMarginPct: 20,
    });
    expect(validateCompanyPolicy(c).some((i) => i.code === "MARGIN_INCONSISTENT")).toBe(true);
  });
  it("propaga issues das estratégias internas", () => {
    const c = createCompanyPolicy({
      companyId: "co_1",
      currency: "BRL",
      marginTarget: { kind: "boom" } as unknown as ReturnType<typeof createMarginTarget>,
    });
    expect(validateCompanyPolicy(c).some((i) => i.code === "INVALID_ENUM")).toBe(true);
  });
});

// ─── CategoryPolicy ──────────────────────────────────────────────────────────
describe("CategoryPolicy", () => {
  it("cria e valida", () => {
    const c = createCategoryPolicy({ categoryId: "cat_1", name: "X" });
    expect(validateCategoryPolicy(c)).toEqual([]);
  });
  it("rejeita não-objeto", () => {
    expect(validateCategoryPolicy(null)[0].code).toBe("INVALID_TYPE");
  });
  it("categoryId obrigatório", () => {
    expect(
      validateCategoryPolicy(createCategoryPolicy({ categoryId: "" })).some(
        (i) => i.code === "REQUIRED_FIELD",
      ),
    ).toBe(true);
  });
  it("margens inconsistentes min>ideal", () => {
    const c = createCategoryPolicy({
      categoryId: "cat_1",
      minMarginPct: 30,
      idealMarginPct: 20,
    });
    expect(validateCategoryPolicy(c).some((i) => i.code === "MARGIN_INCONSISTENT")).toBe(true);
  });
  it("margens inconsistentes ideal>premium", () => {
    const c = createCategoryPolicy({
      categoryId: "cat_1",
      idealMarginPct: 30,
      premiumMarginPct: 20,
    });
    expect(validateCategoryPolicy(c).some((i) => i.code === "MARGIN_INCONSISTENT")).toBe(true);
  });
  it("propaga strategies inválidas", () => {
    const c = createCategoryPolicy({
      categoryId: "cat_1",
      roundingPolicy: { kind: "x" } as unknown as ReturnType<typeof createRoundingEnd90>,
    });
    expect(validateCategoryPolicy(c).some((i) => i.code === "INVALID_ROUNDING_POLICY")).toBe(true);
  });
  it("pct fora de range", () => {
    const c = createCategoryPolicy({ categoryId: "cat_1", minMarginPct: 200 });
    expect(validateCategoryPolicy(c).some((i) => i.code === "OUT_OF_RANGE")).toBe(true);
  });
});

// ─── ProductPolicy ───────────────────────────────────────────────────────────
describe("ProductPolicy", () => {
  it("cria e valida", () => {
    const p = createProductPolicy({ productId: "p1", sku: "SKU-1", priceFloorCents: 5000 });
    expect(validateProductPolicy(p)).toEqual([]);
  });
  it("rejeita não-objeto", () => {
    expect(validateProductPolicy(null)[0].code).toBe("INVALID_TYPE");
  });
  it("productId obrigatório", () => {
    expect(
      validateProductPolicy(createProductPolicy({ productId: "" })).some(
        (i) => i.code === "REQUIRED_FIELD",
      ),
    ).toBe(true);
  });
  it("priceFloor negativo falha", () => {
    const p = createProductPolicy({ productId: "p1", priceFloorCents: -1 });
    expect(validateProductPolicy(p).some((i) => i.code === "NEGATIVE_COST")).toBe(true);
  });
  it("propaga strategies inválidas (behavior)", () => {
    const p = createProductPolicy({
      productId: "p1",
      commercialBehavior: { kind: "x" } as unknown as ReturnType<typeof createStandard>,
    });
    expect(validateProductPolicy(p).some((i) => i.code === "INVALID_COMMERCIAL_BEHAVIOR")).toBe(true);
  });
  it("margens inconsistentes min>ideal", () => {
    const p = createProductPolicy({
      productId: "p1",
      minMarginPct: 40,
      idealMarginPct: 20,
    });
    expect(validateProductPolicy(p).some((i) => i.code === "MARGIN_INCONSISTENT")).toBe(true);
  });
  it("margens inconsistentes ideal>premium", () => {
    const p = createProductPolicy({
      productId: "p1",
      idealMarginPct: 50,
      premiumMarginPct: 10,
    });
    expect(validateProductPolicy(p).some((i) => i.code === "MARGIN_INCONSISTENT")).toBe(true);
  });
  it("pct fora de range", () => {
    const p = createProductPolicy({ productId: "p1", premiumMarginPct: 999 });
    expect(validateProductPolicy(p).some((i) => i.code === "OUT_OF_RANGE")).toBe(true);
  });
});

// ─── Serialização ────────────────────────────────────────────────────────────
describe("Serialization / Envelope", () => {
  const co = () =>
    createCompanyPolicy({
      companyId: "co_1",
      currency: "BRL",
      defaults: { minMarginPct: 10, idealMarginPct: 20, premiumMarginPct: 30 },
    });

  it("toEnvelope monta contêiner versionado", () => {
    const env = toEnvelope("CompanyPolicy", co(), NOW);
    expect(env.envelopeVersion).toBe(CONFIG_DOMAIN_VERSION);
    expect(env.kind).toBe("CompanyPolicy");
    expect(env.serializedAt).toBe(NOW);
  });
  it("round-trip toJSON/fromJSON", () => {
    const raw = toJSON("CompanyPolicy", co(), NOW);
    const env = fromJSON<ReturnType<typeof co>>(raw, { expectKind: "CompanyPolicy" });
    expect(env.payload.companyId).toBe("co_1");
    expect(env.kind).toBe("CompanyPolicy");
  });
  it("fromJSON malformado lança", () => {
    expect(() => fromJSON("{not json}")).toThrow(DomainValidationError);
  });
  it("fromEnvelope aceita objeto direto", () => {
    const env = fromEnvelope(toEnvelope("PriceList", { any: 1 }, NOW));
    expect(env.kind).toBe("PriceList");
  });
  it("fromEnvelope rejeita não-objeto", () => {
    try {
      fromEnvelope(null);
      expect.fail("deveria lançar");
    } catch (e) {
      expect(e).toBeInstanceOf(DomainValidationError);
      expect((e as DomainValidationError).issues[0].code).toBe("MALFORMED_ENVELOPE");
    }
  });
  it("fromEnvelope rejeita versão errada", () => {
    try {
      fromEnvelope({
        envelopeVersion: "x",
        kind: "CompanyPolicy",
        payload: {},
        serializedAt: NOW,
      });
      expect.fail("deveria lançar");
    } catch (e) {
      expect((e as DomainValidationError).issues.some((i) => i.code === "UNSUPPORTED_CONFIG_VERSION")).toBe(true);
    }
  });
  it("fromEnvelope rejeita kind inválido", () => {
    try {
      fromEnvelope({
        envelopeVersion: CONFIG_DOMAIN_VERSION,
        kind: "Bogus",
        payload: {},
        serializedAt: NOW,
      });
      expect.fail("deveria lançar");
    } catch (e) {
      expect((e as DomainValidationError).issues.some((i) => i.code === "MALFORMED_ENVELOPE")).toBe(true);
    }
  });
  it("fromEnvelope rejeita kind divergente do esperado", () => {
    try {
      fromEnvelope(toEnvelope("PriceList", {}, NOW), { expectKind: "CompanyPolicy" });
      expect.fail("deveria lançar");
    } catch (e) {
      expect((e as DomainValidationError).issues[0].code).toBe("MALFORMED_ENVELOPE");
    }
  });
  it("fromEnvelope rejeita payload ausente", () => {
    try {
      fromEnvelope({
        envelopeVersion: CONFIG_DOMAIN_VERSION,
        kind: "CompanyPolicy",
        serializedAt: NOW,
      });
      expect.fail("deveria lançar");
    } catch (e) {
      expect((e as DomainValidationError).issues.some((i) => i.path === "payload")).toBe(true);
    }
  });
});

// ─── Compatibilidade com o Core (não altera contratos existentes) ────────────
describe("Compatibilidade estrutural com Core / Resolver", () => {
  it("CostComposition produzido é aceito pelo shape do Core", () => {
    const c = createCostComposition({ perUnitCostCents: 1000, computedAt: NOW });
    expect(c.version).toBe(COST_COMPOSITION_VERSION);
  });
  it("PriceListEntry produzido tem shape do Core", () => {
    const e = createPriceListEntry("pl_1", {
      productId: "p1",
      priceCents: 1000,
      currency: "BRL",
    });
    expect(e.version).toBe(PRICE_LIST_VERSION);
    expect(e.fallback).toBe("derived");
  });
  it("ChannelContract e TaxQuote carregam versões esperadas", () => {
    expect(
      createChannelContract({
        channelId: "ml",
        variableFeePct: 0,
        fixedFeePerOrderCents: 0,
        operationalCostCents: 0,
      }).version,
    ).toBe(CHANNEL_CONTRACT_VERSION);
    expect(
      createTaxQuote({
        quoteId: "q",
        totalPctOnPrice: 0,
        totalFixedCents: 0,
        taxEngineVersion: "tax-engine/1.0.0",
      }).version,
    ).toBe(TAX_QUOTE_VERSION);
  });
});
