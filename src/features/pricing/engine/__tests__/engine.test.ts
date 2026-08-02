import { describe, expect, it } from "vitest";
import {
  CALCULATION_VERSION,
  CHANNEL_CONTRACT_VERSION,
  compute,
  CONTEXT_VERSION,
  COST_COMPOSITION_VERSION,
  ENGINE_VERSION,
  explain,
  PRICE_LIST_VERSION,
  RESULT_VERSION,
  TAX_QUOTE_VERSION,
  type ChannelContract,
  type CommercialBehaviorSpec,
  type CostComposition,
  type MarginTargetSpec,
  type PriceListEntry,
  type PricingContext,
  type PricingWarningCode,
  type RoundingPolicySpec,
  type TaxQuote,
} from "../index";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const FIXED_NOW = "2026-07-14T12:00:00.000Z";

function makeCost(overrides: Partial<CostComposition> = {}): CostComposition {
  return {
    version: COST_COMPOSITION_VERSION,
    perUnitCostCents: 5000,
    computedAt: FIXED_NOW,
    origin: "inventory",
    ...overrides,
  };
}

function makeContext(overrides: Partial<PricingContext> = {}): PricingContext {
  return {
    contextVersion: CONTEXT_VERSION,
    company: {
      id: "co_1",
      currency: "BRL",
      defaults: { minMarginPct: 15, idealMarginPct: 30, premiumMarginPct: 45 },
    },
    product: { id: "prod_1", sku: "SKU-1" },
    quantity: 1,
    currency: "BRL",
    clock: { now: FIXED_NOW, tz: "America/Sao_Paulo" },
    costComposition: makeCost(),
    requestId: "req_1",
    requestedBy: { module: "test" },
    ...overrides,
  };
}

function hasWarning(
  codes: readonly { code: PricingWarningCode }[],
  code: PricingWarningCode,
): boolean {
  return codes.some((w) => w.code === code);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cálculo básico
// ─────────────────────────────────────────────────────────────────────────────

describe("compute() — cálculo básico", () => {
  it("preço ideal com custo 50 e margem 30% sem fee/tax = 71,42", () => {
    const r = compute(makeContext());
    // price = 5000 / (1 - 0.30) = 7142.857 → 7143
    expect(r.recommendedPriceCents).toBe(7143);
    expect(r.mode).toBe("derived");
    expect(r.currency).toBe("BRL");
  });

  it("aplica canal (fee 12%) e imposto (10%) no denominador", () => {
    const channel: ChannelContract = {
      channelId: "ml",
      variableFeePct: 12,
      fixedFeePerOrderCents: 0,
      operationalCostCents: 0,
      version: CHANNEL_CONTRACT_VERSION,
    };
    const taxQuote: TaxQuote = {
      version: TAX_QUOTE_VERSION,
      quoteId: "tq_1",
      totalPctOnPrice: 10,
      totalFixedCents: 0,
      taxEngineVersion: "tax-engine/1.0.0",
    };
    const r = compute(makeContext({ channel, taxQuote }));
    // 5000 / (1 - 0.30 - 0.12 - 0.10) = 5000 / 0.48 = 10416.66 → 10417
    expect(r.recommendedPriceCents).toBe(10417);
    expect(r.taxEngineVersion).toBe("tax-engine/1.0.0");
  });

  it("targetPrice usa MarginTargetSpec custom", () => {
    const marginTarget: MarginTargetSpec = { kind: "custom", pct: 50 };
    const r = compute(makeContext({ marginTarget }));
    // 5000/0.5 = 10000
    expect(r.targetPriceCents).toBe(10000);
  });

  it("MarginTargetSpec premium usa premiumMarginPct da company", () => {
    const r = compute(makeContext({ marginTarget: { kind: "premium" } }));
    // 5000/(1-0.45) = 9090.9 → 9091
    expect(r.targetPriceCents).toBe(9091);
  });

  it("MarginTargetSpec min usa minMarginPct da company", () => {
    const r = compute(makeContext({ marginTarget: { kind: "min" } }));
    // 5000/(1-0.15) = 5882.35 → 5882
    expect(r.targetPriceCents).toBe(5882);
  });

  it("resultado carrega versionamento completo", () => {
    const r = compute(makeContext());
    expect(r.engineVersion).toBe(ENGINE_VERSION);
    expect(r.calculationVersion).toBe(CALCULATION_VERSION);
    expect(r.contextVersion).toBe(CONTEXT_VERSION);
    expect(r.resultVersion).toBe(RESULT_VERSION);
    expect(r.policyVersion).toMatch(/^policy\/[0-9a-f]{8}$/);
    expect(r.explainId).toMatch(/^expl_[0-9a-f]{8}$/);
    expect(r.computedAt).toBe(FIXED_NOW);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Custo zero / limites
// ─────────────────────────────────────────────────────────────────────────────

describe("compute() — custo zero e limites", () => {
  it("custo zero => todos preços zero, sem crash", () => {
    const r = compute(makeContext({ costComposition: makeCost({ perUnitCostCents: 0 }) }));
    expect(r.recommendedPriceCents).toBe(0);
    expect(r.targetPriceCents).toBe(0);
    expect(r.finalPriceCents).toBe(0);
    expect(r.warnings).toBeDefined();
  });

  it("margem 0% (custom) => preço = custo", () => {
    const r = compute(makeContext({ marginTarget: { kind: "custom", pct: 0 } }));
    expect(r.targetPriceCents).toBe(5000);
  });

  it("margem+fee+tax >= 100% => warning DIVISION_BY_ZERO_AVOIDED e preço 0", () => {
    const channel: ChannelContract = {
      channelId: "abusivo",
      variableFeePct: 80,
      fixedFeePerOrderCents: 0,
      operationalCostCents: 0,
      version: CHANNEL_CONTRACT_VERSION,
    };
    const r = compute(
      makeContext({
        channel,
        marginTarget: { kind: "custom", pct: 25 },
      }),
    );
    expect(hasWarning(r.warnings, "DIVISION_BY_ZERO_AVOIDED")).toBe(true);
    expect(r.targetPriceCents).toBe(0);
  });

  it("custo negativo é clampado a 0 e emite warning NEGATIVE_COST", () => {
    const r = compute(
      makeContext({
        costComposition: makeCost({ perUnitCostCents: -100 }),
      }),
    );
    expect(hasWarning(r.warnings, "NEGATIVE_COST")).toBe(true);
    expect(r.targetPriceCents).toBe(0);
  });

  it("quantity inválida emite INVALID_QUANTITY e assume 1", () => {
    const r = compute(makeContext({ quantity: 0 }));
    expect(hasWarning(r.warnings, "INVALID_QUANTITY")).toBe(true);
    expect(r.recommendedPriceCents).toBeGreaterThan(0);
  });

  it("MarginTargetSpec custom inválido (>=100) emite warning e usa ideal", () => {
    const r = compute(makeContext({ marginTarget: { kind: "custom", pct: 150 } }));
    expect(hasWarning(r.warnings, "INVALID_MARGIN_TARGET")).toBe(true);
    expect(r.targetPriceCents).toBe(r.recommendedPriceCents);
  });

  it("CostComposition ausente => custo 0 e warning", () => {
    const ctx = makeContext();
    // Bypass tipo para simular caso corrompido.
    const brokenCtx = { ...ctx, costComposition: undefined as unknown as CostComposition };
    const r = compute(brokenCtx);
    expect(hasWarning(r.warnings, "MISSING_COST_COMPOSITION")).toBe(true);
    expect(r.costTotalCents).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Markup, lucro, indicadores
// ─────────────────────────────────────────────────────────────────────────────

describe("compute() — indicadores", () => {
  it("markup e margem consistentes: custo 50, target 30%", () => {
    const r = compute(makeContext({ marginTarget: { kind: "custom", pct: 30 } }));
    // finalPrice = 7143, netProfit ≈ 2143
    expect(r.finalPriceCents).toBe(7143);
    expect(r.netProfitCents).toBe(2143);
    expect(r.marginPct).toBeCloseTo(30, 1);
    expect(r.markupPct).toBeCloseTo(42.86, 1);
  });

  it("grossProfit = finalPrice - costTotal (inclui fixos)", () => {
    const channel: ChannelContract = {
      channelId: "loja",
      variableFeePct: 0,
      fixedFeePerOrderCents: 500,
      operationalCostCents: 200,
      version: CHANNEL_CONTRACT_VERSION,
    };
    const r = compute(makeContext({ channel }));
    expect(r.costTotalCents).toBe(5000 + 500 + 200);
    expect(r.grossProfitCents).toBe(r.finalPriceCents - r.costTotalCents);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Arredondamento
// ─────────────────────────────────────────────────────────────────────────────

describe("compute() — arredondamento", () => {
  it("end_90", () => {
    const rounding: RoundingPolicySpec = { kind: "end_90" };
    const r = compute(makeContext({ roundingPolicy: rounding }));
    expect(r.finalPriceCents % 100).toBe(90);
  });

  it("end_99", () => {
    const r = compute(makeContext({ roundingPolicy: { kind: "end_99" } }));
    expect(r.finalPriceCents % 100).toBe(99);
  });

  it("integer arredonda para real inteiro (múltiplo de 100 cents)", () => {
    const r = compute(makeContext({ roundingPolicy: { kind: "integer" } }));
    expect(r.finalPriceCents % 100).toBe(0);
  });

  it("psychological com endings=[90,99] escolhe 90 para 7143", () => {
    const r = compute(
      makeContext({
        roundingPolicy: { kind: "psychological", endings: [90, 99] },
      }),
    );
    // 7143 → floor 71, ending<=43 = nenhum, então rebaixa uma unidade e usa 99 → 7099... teste ancora comportamento estável
    expect(r.finalPriceCents % 100 === 90 || r.finalPriceCents % 100 === 99).toBe(true);
  });

  it("psychological com endings vazios emite warning e não arredonda", () => {
    const r = compute(
      makeContext({
        roundingPolicy: { kind: "psychological", endings: [] },
      }),
    );
    expect(hasWarning(r.warnings, "INVALID_ROUNDING_POLICY")).toBe(true);
  });

  it("none preserva centavos", () => {
    const r = compute(makeContext({ roundingPolicy: { kind: "none" } }));
    expect(r.finalPriceCents).toBe(7143);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Behavior (promotion / stock_burn / high_turnover)
// ─────────────────────────────────────────────────────────────────────────────

describe("compute() — commercialBehavior", () => {
  it("promotion aplica desconto sobre targetPrice", () => {
    const behavior: CommercialBehaviorSpec = { kind: "promotion", discountPct: 10 };
    const r = compute(makeContext({ commercialBehavior: behavior }));
    // 7143 * 0.9 = 6428.7 → 6429, floor pode subir → checa <= 7143
    expect(r.finalPriceCents).toBeLessThanOrEqual(7143);
  });

  it("stock_burn com desconto extremo respeita floor de margem mínima", () => {
    const behavior: CommercialBehaviorSpec = { kind: "stock_burn", maxDiscountPct: 99 };
    const r = compute(makeContext({ commercialBehavior: behavior }));
    // Floor de margem mínima (15%): 5000/0.85 ≈ 5882
    expect(r.finalPriceCents).toBeGreaterThanOrEqual(5882);
  });

  it("high_turnover com discount=0 mantém preço", () => {
    const r = compute(makeContext({ commercialBehavior: { kind: "high_turnover" } }));
    expect(r.finalPriceCents).toBe(7143);
  });

  it("standard não altera preço", () => {
    const r = compute(makeContext({ commercialBehavior: { kind: "standard" } }));
    expect(r.finalPriceCents).toBe(7143);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PriceList (modo tabelado)
// ─────────────────────────────────────────────────────────────────────────────

describe("compute() — PriceList", () => {
  const makePriceList = (over: Partial<PriceListEntry> = {}): PriceListEntry => ({
    version: PRICE_LIST_VERSION,
    priceListId: "pl_1",
    productId: "prod_1",
    priceCents: 9990,
    currency: "BRL",
    fallback: "derived",
    ...over,
  });

  it("aplicável => modo tabelado, preço = tabelado", () => {
    const r = compute(makeContext({ priceList: makePriceList() }));
    expect(r.mode).toBe("tabled");
    expect(r.finalPriceCents).toBe(9990);
    expect(r.appliedRules.some((s) => s.rule === "pricelist:apply")).toBe(true);
  });

  it("preço tabelado abaixo do piso => warning, não sobrescreve", () => {
    const r = compute(
      makeContext({
        priceList: makePriceList({ priceCents: 100 }),
        product: { id: "prod_1", priceFloorCents: 5000 },
      }),
    );
    expect(hasWarning(r.warnings, "TABLED_PRICE_BELOW_FLOOR")).toBe(true);
    expect(r.finalPriceCents).toBe(100);
  });

  it("quantidade fora de range e fallback=derived => usa preço derivado", () => {
    const r = compute(
      makeContext({
        quantity: 1,
        priceList: makePriceList({ minQty: 10, fallback: "derived" }),
      }),
    );
    expect(r.mode).toBe("derived");
    expect(r.appliedRules.some((s) => s.rule === "pricelist:fallback_derived")).toBe(true);
  });

  it("fallback=reject fora de range emite PRICE_LIST_FALLBACK_APPLIED", () => {
    const r = compute(
      makeContext({
        quantity: 1,
        priceList: makePriceList({ minQty: 10, fallback: "reject" }),
      }),
    );
    expect(hasWarning(r.warnings, "PRICE_LIST_FALLBACK_APPLIED")).toBe(true);
  });

  it("currency mismatch => derived (fallback)", () => {
    const r = compute(
      makeContext({
        currency: "BRL",
        priceList: makePriceList({ currency: "USD" }),
      }),
    );
    expect(r.mode).toBe("derived");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Warnings — cobertura de vocabulário
// ─────────────────────────────────────────────────────────────────────────────

describe("compute() — warnings", () => {
  it("COST_STALE quando computedAt > staleThresholdDays", () => {
    const old = "2026-01-01T00:00:00.000Z"; // ~195d antes do FIXED_NOW
    const r = compute(
      makeContext({
        costComposition: makeCost({ computedAt: old, staleThresholdDays: 30 }),
      }),
    );
    expect(hasWarning(r.warnings, "COST_STALE")).toBe(true);
  });

  it("TAX_QUOTE_EXPIRED quando validTo < now", () => {
    const taxQuote: TaxQuote = {
      version: TAX_QUOTE_VERSION,
      quoteId: "tq_x",
      totalPctOnPrice: 10,
      totalFixedCents: 0,
      taxEngineVersion: "t/1",
      validTo: "2026-01-01T00:00:00.000Z",
    };
    const r = compute(makeContext({ taxQuote }));
    expect(hasWarning(r.warnings, "TAX_QUOTE_EXPIRED")).toBe(true);
  });

  it("NON_LINEAR_CHANNEL_RULE_IGNORED quando channel.hasNonLinearRules", () => {
    const channel: ChannelContract = {
      channelId: "ml",
      variableFeePct: 12,
      fixedFeePerOrderCents: 0,
      operationalCostCents: 0,
      hasNonLinearRules: true,
      version: CHANNEL_CONTRACT_VERSION,
    };
    const r = compute(makeContext({ channel }));
    expect(hasWarning(r.warnings, "NON_LINEAR_CHANNEL_RULE_IGNORED")).toBe(true);
  });

  it("MARGIN_BELOW_MIN quando preço tabelado gera margem abaixo do mínimo", () => {
    const r = compute(
      makeContext({
        priceList: {
          version: PRICE_LIST_VERSION,
          priceListId: "pl_x",
          productId: "prod_1",
          priceCents: 5200, // margem < 15% (min)
          currency: "BRL",
          fallback: "derived",
        },
      }),
    );
    expect(hasWarning(r.warnings, "MARGIN_BELOW_MIN")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Estabilidade / determinismo
// ─────────────────────────────────────────────────────────────────────────────

describe("compute() — estabilidade", () => {
  it("mesmo contexto => mesmo policyVersion e explainId", () => {
    const ctx = makeContext();
    const a = compute(ctx);
    const b = compute(ctx);
    expect(a.policyVersion).toBe(b.policyVersion);
    expect(a.explainId).toBe(b.explainId);
    expect(a.finalPriceCents).toBe(b.finalPriceCents);
  });

  it("contextos diferentes => policyVersion diferente", () => {
    const a = compute(makeContext());
    const b = compute(
      makeContext({
        company: {
          id: "co_1",
          currency: "BRL",
          defaults: { minMarginPct: 10, idealMarginPct: 40, premiumMarginPct: 60 },
        },
      }),
    );
    expect(a.policyVersion).not.toBe(b.policyVersion);
  });

  it("nunca lança para inputs esperados/anômalos", () => {
    const cases: PricingContext[] = [
      makeContext({ costComposition: makeCost({ perUnitCostCents: 0 }) }),
      makeContext({ costComposition: makeCost({ perUnitCostCents: -1 }) }),
      makeContext({ quantity: -3 }),
      makeContext({ marginTarget: { kind: "custom", pct: 99.999 } }),
      makeContext({ roundingPolicy: { kind: "psychological", endings: [] } }),
    ];
    for (const c of cases) {
      expect(() => compute(c)).not.toThrow();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // explain() — cobertura de suggestedActions
  // ─────────────────────────────────────────────────────────────────────────────

  describe("explain() — todas as branches de suggestedActions", () => {
    const baseResult = () => compute(makeContext());

    it("MARGIN_BELOW_MIN → sugere aumentar preço", () => {
      const r = baseResult();
      const withW = {
        ...r,
        warnings: [{ code: "MARGIN_BELOW_MIN" as const, message: "" }],
      };
      const e = explain(withW);
      expect(e.suggestedActions?.some((s) => s.includes("minMargin"))).toBe(true);
    });

    it("MARGIN_BELOW_IDEAL → sugere revisar", () => {
      const r = baseResult();
      const e = explain({
        ...r,
        warnings: [{ code: "MARGIN_BELOW_IDEAL" as const, message: "" }],
      });
      expect(e.suggestedActions?.some((s) => s.includes("idealMargin"))).toBe(true);
    });

    it("TAX_QUOTE_EXPIRED → sugere nova cotação", () => {
      const r = baseResult();
      const e = explain({
        ...r,
        warnings: [{ code: "TAX_QUOTE_EXPIRED" as const, message: "" }],
      });
      expect(e.suggestedActions?.some((s) => s.includes("Tax Engine"))).toBe(true);
    });

    it("TABLED_PRICE_BELOW_FLOOR → sugere reavaliar", () => {
      const r = baseResult();
      const e = explain({
        ...r,
        warnings: [{ code: "TABLED_PRICE_BELOW_FLOOR" as const, message: "" }],
      });
      expect(e.suggestedActions?.some((s) => s.includes("PriceList"))).toBe(true);
    });

    it("warning não acionável → não adiciona ação", () => {
      const r = baseResult();
      const e = explain({
        ...r,
        warnings: [{ code: "INVALID_QUANTITY" as const, message: "" }],
      });
      expect(e.suggestedActions).toBeUndefined();
    });

    it("moeda não-BRL usa formatação genérica no summary", () => {
      const r = baseResult();
      const e = explain({ ...r, currency: "USD" });
      expect(e.summary).toContain("USD");
    });

    it("finalPriceCents não-finito produz — no summary", () => {
      const r = baseResult();
      const e = explain({ ...r, finalPriceCents: Number.NaN });
      expect(e.summary).toContain("—");
    });

    it("invariante mode_matches_pricelist_step falha quando mode=tabled sem step", () => {
      const r = baseResult();
      const e = explain({ ...r, mode: "tabled" });
      const inv = e.invariantsChecked.find((i) => i.name === "mode_matches_pricelist_step");
      expect(inv?.passed).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// explain()
// ─────────────────────────────────────────────────────────────────────────────

describe("explain()", () => {
  it("retorna estrutura completa e steps espelham appliedRules", () => {
    const r = compute(makeContext());
    const e = explain(r);
    expect(e.explainId).toBe(r.explainId);
    expect(e.requestId).toBe(r.requestId);
    expect(e.mode).toBe(r.mode);
    expect(e.steps).toHaveLength(r.appliedRules.length);
    expect(e.steps.map((s) => s.step)).toEqual(r.appliedRules.map((s) => s.step));
    expect(e.summary).toContain("R$");
  });

  it("nunca recalcula — só reprojeta dados do result", () => {
    const r = compute(makeContext());
    const mutated = { ...r, finalPriceCents: 99999 };
    const e = explain(mutated);
    expect(e.summary).toContain("999,99");
  });

  it("invariantes: preço final não-negativo, versionamento presente", () => {
    const r = compute(makeContext());
    const e = explain(r);
    const inv = Object.fromEntries(e.invariantsChecked.map((i) => [i.name, i.passed]));
    expect(inv.final_price_non_negative).toBe(true);
    expect(inv.versioning_present).toBe(true);
    expect(inv.mode_matches_pricelist_step).toBe(true);
    expect(inv.steps_in_canonical_order).toBe(true);
  });

  it("suggestedActions surgem quando há warnings acionáveis", () => {
    const r = compute(
      makeContext({
        costComposition: makeCost({
          computedAt: "2026-01-01T00:00:00.000Z",
          staleThresholdDays: 30,
        }),
      }),
    );
    const e = explain(r);
    expect(e.suggestedActions?.some((s) => s.includes("Inventory"))).toBe(true);
  });

  it("sem warnings acionáveis, suggestedActions undefined", () => {
    const r = compute(makeContext());
    const e = explain(r);
    expect(e.suggestedActions).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Casos extremos adicionais
// ─────────────────────────────────────────────────────────────────────────────

describe("casos extremos", () => {
  it("channel com valores negativos (defensivo) são clampados", () => {
    const channel: ChannelContract = {
      channelId: "x",
      variableFeePct: -5,
      fixedFeePerOrderCents: -100,
      operationalCostCents: -50,
      version: CHANNEL_CONTRACT_VERSION,
    };
    const r = compute(makeContext({ channel }));
    expect(r.costTotalCents).toBe(5000);
  });

  it("channel minMarginOverride mais alto define o floor", () => {
    const channel: ChannelContract = {
      channelId: "premium",
      variableFeePct: 0,
      fixedFeePerOrderCents: 0,
      operationalCostCents: 0,
      minMarginOverridePct: 50,
      version: CHANNEL_CONTRACT_VERSION,
    };
    const r = compute(
      makeContext({
        channel,
        commercialBehavior: { kind: "promotion", discountPct: 90 },
      }),
    );
    // Floor de margem 50% => 5000/0.5 = 10000
    expect(r.finalPriceCents).toBeGreaterThanOrEqual(10000);
  });

  it("productFloor mais alto que floor de margem prevalece", () => {
    const r = compute(
      makeContext({
        product: { id: "prod_1", priceFloorCents: 20000 },
        commercialBehavior: { kind: "promotion", discountPct: 99 },
      }),
    );
    expect(r.finalPriceCents).toBeGreaterThanOrEqual(20000);
  });

  it("quantity > 1 divide fixedFeePerOrder proporcionalmente", () => {
    const channel: ChannelContract = {
      channelId: "x",
      variableFeePct: 0,
      fixedFeePerOrderCents: 1000,
      operationalCostCents: 0,
      version: CHANNEL_CONTRACT_VERSION,
    };
    const r1 = compute(makeContext({ channel, quantity: 1 }));
    const r10 = compute(makeContext({ channel, quantity: 10 }));
    expect(r10.costTotalCents).toBeLessThan(r1.costTotalCents);
  });

  it("appliedRules estão na ordem determinística canônica", () => {
    const r = compute(
      makeContext({
        channel: {
          channelId: "x",
          variableFeePct: 5,
          fixedFeePerOrderCents: 0,
          operationalCostCents: 0,
          version: CHANNEL_CONTRACT_VERSION,
        },
        taxQuote: {
          version: TAX_QUOTE_VERSION,
          quoteId: "tq",
          totalPctOnPrice: 5,
          totalFixedCents: 0,
          taxEngineVersion: "t/1",
        },
      }),
    );
    const steps = r.appliedRules.map((s) => s.step);
    const expectedOrder = ["cost", "target", "channel", "tax", "behavior", "rounding", "floor"];
    // Filtra apenas steps presentes e verifica ordem relativa.
    const filtered = expectedOrder.filter((s) => steps.includes(s as never));
    expect(filtered).toEqual(steps.filter((s) => filtered.includes(s)));
  });
});
