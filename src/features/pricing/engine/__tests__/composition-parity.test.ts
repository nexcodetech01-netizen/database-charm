/**
 * Parity tests — Cost Composition Single Source of Truth
 * ======================================================
 * Garante que:
 *   1. `composeCostComposition` é a fórmula canônica: cost + frete +
 *      embalagem + seguro + outras despesas.
 *   2. Todos os consumidores (Cadastro, Simulador, Produtos, Dashboard,
 *      Marketplace, Bella, Catálogo) produzem exatamente o mesmo
 *      `finalPriceCents` para a mesma composição de custos.
 *   3. Se um consumidor legado passar `perUnitCostCents` divergente,
 *      o engine ignora, usa a soma canônica e emite `COST_COMPONENTS_MISMATCH`.
 */
import { describe, expect, it } from "vitest";
import {
  composeCostComposition,
  compute,
  CONTEXT_VERSION,
  COST_COMPOSITION_VERSION,
  sumCostComponentsCents,
  type PricingContext,
} from "../index";

const NOW = "2026-07-14T12:00:00.000Z";

function baseContext(cost: PricingContext["costComposition"]): PricingContext {
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
    clock: { now: NOW, tz: "America/Sao_Paulo" },
    costComposition: cost,
    requestId: "req_parity",
    requestedBy: { module: "test-parity" },
  };
}

const RAW = {
  acquisitionCostCents: 5000,
  freightCents: 320,
  packagingCents: 180,
  insuranceCents: 90,
  otherExpensesCents: 110,
  computedAt: NOW,
  origin: "inventory" as const,
};

describe("Cost Composition — canonical single source of truth", () => {
  it("sumCostComponentsCents soma os 5 componentes exatamente", () => {
    expect(
      sumCostComponentsCents({
        acquisitionCostCents: 5000,
        freightCents: 320,
        packagingCents: 180,
        insuranceCents: 90,
        otherExpensesCents: 110,
      }),
    ).toBe(5700);
  });

  it("composeCostComposition deriva perUnitCostCents a partir dos componentes", () => {
    const cc = composeCostComposition(RAW);
    expect(cc.version).toBe(COST_COMPOSITION_VERSION);
    expect(cc.perUnitCostCents).toBe(5700);
    expect(cc.acquisitionCostCents).toBe(5000);
    expect(cc.freightCents).toBe(320);
    expect(cc.packagingCents).toBe(180);
    expect(cc.insuranceCents).toBe(90);
    expect(cc.otherExpensesCents).toBe(110);
  });

  it("componentes ausentes contam como 0 (não NaN)", () => {
    const cc = composeCostComposition({
      acquisitionCostCents: 1000,
      computedAt: NOW,
      origin: "manual",
    });
    expect(cc.perUnitCostCents).toBe(1000);
    expect(cc.freightCents).toBe(0);
    expect(cc.packagingCents).toBe(0);
  });

  it("todos os consumidores (product/simulator/dashboard/bella) produzem o mesmo finalPriceCents", () => {
    // Cada consumidor real, se refatorado, chega no engine com composição idêntica.
    const cc = composeCostComposition(RAW);
    const modules = [
      "product-detail",
      "pricing-simulator",
      "commercial-dashboard",
      "bella-ai",
      "catalog",
      "marketplace",
    ];
    const results = modules.map((mod) => {
      const ctx: PricingContext = {
        ...baseContext(cc),
        requestedBy: { module: mod },
      };
      return compute(ctx);
    });

    const finals = new Set(results.map((r) => r.finalPriceCents));
    expect(finals.size).toBe(1);
    for (const r of results) {
      const costRule = r.appliedRules.find((rule) => rule.step === "cost");
      expect(costRule?.detail?.perUnitCostCents).toBe(5700);
    }
  });

  it("engine ignora perUnitCostCents divergente e emite COST_COMPONENTS_MISMATCH", () => {
    const badCC = {
      ...composeCostComposition(RAW),
      perUnitCostCents: 9999, // valor legado incorreto
    };
    const result = compute(baseContext(badCC));
    const costRule = result.appliedRules.find((r) => r.step === "cost");
    expect(costRule?.detail?.perUnitCostCents).toBe(5700); // engine usou a soma canônica
    const mismatch = result.warnings.find((w) => w.code === "COST_COMPONENTS_MISMATCH");
    expect(mismatch).toBeTruthy();
  });

  it("engine mantém comportamento retrocompatível quando só perUnitCostCents é informado", () => {
    const legacy: PricingContext["costComposition"] = {
      version: COST_COMPOSITION_VERSION,
      perUnitCostCents: 4200,
      computedAt: NOW,
      origin: "manual",
    };
    const result = compute(baseContext(legacy));
    const costRule = result.appliedRules.find((r) => r.step === "cost");
    expect(costRule?.detail?.perUnitCostCents).toBe(4200);
    expect(result.warnings.find((w) => w.code === "COST_COMPONENTS_MISMATCH")).toBeUndefined();
  });
});

