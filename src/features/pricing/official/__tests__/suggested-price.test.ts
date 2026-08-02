import { describe, expect, it } from "vitest";
import {
  buildFeeTable,
  computeSuggestedPrice,
  EMPTY_FEE_TABLE,
  evaluateOfficialPrice,
  resolveChannelFee,
  solvePriceForTargetProfit,
} from "../index";
import { resolveMargins, FALLBACK_MARGINS } from "../../data/pricing-inputs";

const feeTable = buildFeeTable([
  {
    method_key: "pix",
    label: "PIX",
    installments: 1,
    fee_percent: 0.99,
    fee_fixed: 0,
    active: true,
  },
  {
    method_key: "credit_card_1",
    label: "Crédito 1x",
    installments: 1,
    fee_percent: 2.99,
    fee_fixed: 0.49,
    active: true,
  },
  {
    method_key: "credit_card_2",
    label: "Crédito 2x",
    installments: 2,
    fee_percent: 3.29,
    fee_fixed: 0.49,
    active: true,
  },
  {
    method_key: "credit_card_3",
    label: "Crédito 3x",
    installments: 3,
    fee_percent: 3.49,
    fee_fixed: 0.49,
    active: true,
  },
]);

const base = {
  companyId: "c1",
  productId: "p1",
  costs: {
    acquisition: 30,
    freight: 2,
    packaging: 1,
    label: 0.5,
    insurance: 0.5,
    otherCosts: 1,
    operationalExpenses: 1,
  },
  margins: { minPct: 10, targetPct: 50, premiumPct: 60 },
  feeTable,
};

describe("Motor Comercial V2 — preço sugerido único", () => {
  it("aplica TODOS os componentes de custo na formação", () => {
    const semExtras = computeSuggestedPrice({
      ...base,
      costs: { acquisition: 30 },
    });
    const comExtras = computeSuggestedPrice(base);
    expect(comExtras.costTotal).toBeGreaterThan(semExtras.costTotal);
    expect(comExtras.targetPrice).toBeGreaterThan(semExtras.targetPrice);
  });

  it("usa a taxa real do Asaas (pior caso) — nunca percentual hardcoded", () => {
    const semTaxa = computeSuggestedPrice({ ...base, feeTable: EMPTY_FEE_TABLE });
    const comTaxa = computeSuggestedPrice(base);
    expect(semTaxa.feePct).toBe(0);
    expect(comTaxa.feePct).toBeGreaterThan(0);
    expect(comTaxa.targetPrice).toBeGreaterThan(semTaxa.targetPrice);
  });

  it("respeita a política de parcelamento: até R$ 100 somente 1x", () => {
    const barato = computeSuggestedPrice(base);
    expect(barato.targetPrice).toBeLessThanOrEqual(100);
    // 1x = 2,99% + 0,49 → taxa efetiva acima de 2,99%
    expect(barato.feePct).toBeCloseTo(2.99, 2);
  });

  it("acima de R$ 100 considera o pior caso até 3x", () => {
    const caro = computeSuggestedPrice({
      ...base,
      costs: { acquisition: 200 },
    });
    expect(caro.targetPrice).toBeGreaterThan(100);
    expect(caro.feePct).toBeCloseTo(3.49, 2);
  });

  it("aplica impostos quando configurados", () => {
    const semImposto = computeSuggestedPrice(base);
    const comImposto = computeSuggestedPrice({ ...base, taxPct: 6 });
    expect(comImposto.taxPct).toBe(6);
    expect(comImposto.targetPrice).toBeGreaterThan(semImposto.targetPrice);
  });

  it("gera auditoria completa até o lucro líquido", () => {
    const r = computeSuggestedPrice(base);
    const keys = r.audit.map((l) => l.key);
    expect(keys).toContain("fee");
    expect(keys).toContain("tax");
    expect(keys).toContain("profit");
    expect(keys).toContain("final_price");
  });

  it("é determinístico (mesma entrada → mesmo preço)", () => {
    expect(computeSuggestedPrice(base).targetPrice).toBe(computeSuggestedPrice(base).targetPrice);
  });
});

describe("Resolução de margem — categoria vence empresa", () => {
  it("usa a margem da categoria quando existir", () => {
    const { margins, source } = resolveMargins(
      { minPct: 10, targetPct: 50, premiumPct: 50 },
      { minPct: 20, targetPct: 65, maxPct: 80 },
    );
    expect(source).toBe("category");
    expect(margins.targetPct).toBe(65);
    expect(margins.minPct).toBe(20);
    expect(margins.maxPct).toBe(80);
  });

  it("cai para a política da empresa quando a categoria não tem configuração", () => {
    const { margins, source } = resolveMargins({ minPct: 10, targetPct: 50 }, null);
    expect(source).toBe("company");
    expect(margins.targetPct).toBe(50);
  });

  it("cai para o fallback canônico quando nada está configurado", () => {
    const { margins, source } = resolveMargins(null, null);
    expect(source).toBe("fallback");
    expect(margins).toEqual(FALLBACK_MARGINS);
  });
});

describe("solvePriceForTargetProfit / canais", () => {
  it("usa a taxa do catálogo quando a empresa não configurou o canal", () => {
    expect(resolveChannelFee("ml").feePct).toBe(16);
    expect(resolveChannelFee("ml", { feePct: 12, fixedCost: 4 })).toMatchObject({
      feePct: 12,
      fixedFee: 4,
    });
  });

  it("resolve o preço que preserva o lucro alvo aplicando a taxa do canal", () => {
    const input = {
      companyId: "c1",
      productId: "p1",
      costs: { acquisition: 100 },
      margins: { minPct: 0, targetPct: 30 },
      fee: { pct: 16, fixed: 6, label: "Mercado Livre" },
      module: "test" as const,
    };
    const price = solvePriceForTargetProfit(input, 50);
    expect(price).not.toBeNull();
    const evaluated = evaluateOfficialPrice(price as number, input);
    expect(evaluated.profit).toBeGreaterThanOrEqual(49.99);
    expect(evaluated.profit).toBeLessThan(50.05);
  });

  it("retorna null para lucro alvo impossível", () => {
    expect(
      solvePriceForTargetProfit(
        {
          companyId: "c1",
          productId: "p1",
          costs: { acquisition: 10 },
          margins: { minPct: 0, targetPct: 30 },
          fee: { pct: 100, fixed: 0, label: "x" },
          module: "test" as const,
        },
        10,
      ),
    ).toBeNull();
  });
});
