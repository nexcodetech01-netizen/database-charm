/**
 * MOTOR COMERCIAL OFICIAL — suíte de validação (FASES 1–8).
 * Garante motor único, taxas reais, políticas por categoria,
 * auditoria completa e proteções comerciais.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  computeOfficialPricing,
  evaluateOfficialPrice,
  evaluatePriceGuards,
  hasBlockingGuard,
  buildFeeTable,
  resolveFee,
  worstCaseFee,
  effectiveFeePct,
  allowedInstallments,
  maxInstallmentsForAmount,
  INSTALLMENT_MIN_AMOUNT,
  MAX_INSTALLMENTS_NO_INTEREST,
  EMPTY_FEE_TABLE,
} from "../index";

const baseInput = {
  companyId: "c1",
  productId: "p1",
  costs: { acquisition: 100 },
  margins: { minPct: 10, targetPct: 30, premiumPct: 45 },
};

describe("FASE 1/2 — motor único", () => {
  it("forma preço a partir do custo e da margem alvo (margem sobre preço)", () => {
    const r = computeOfficialPricing(baseInput);
    // 100 / (1 - 0.30) = 142,86
    expect(r.recommendedPrice).toBeCloseTo(142.86, 1);
    expect(r.costTotal).toBeCloseTo(100, 2);
  });

  it("é determinístico: mesma entrada → mesmo preço", () => {
    expect(computeOfficialPricing(baseInput).targetPrice).toBe(
      computeOfficialPricing(baseInput).targetPrice,
    );
  });

  it("não existe mais nenhum import do motor legado `pricing/calculator`", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry === "node_modules") continue;
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry)) continue;
        if (full.includes("official-engine.test")) continue;
        const src = readFileSync(full, "utf8");
        if (/from ["'][^"']*pricing\/calculator["']/.test(src)) hits.push(full);
      }
    };
    walk("src");
    expect(hits).toEqual([]);
  });
});

describe("FASE 3 — custos unificados", () => {
  it("soma fornecedor, frete, embalagem, etiqueta, seguro, comissão, operacional e perdas", () => {
    const r = computeOfficialPricing({
      ...baseInput,
      costs: {
        acquisition: 100,
        freight: 10,
        packaging: 5,
        label: 1,
        insurance: 2,
        commission: 3,
        otherCosts: 4,
        operationalExpenses: 5,
        lossPct: 10,
      },
    });
    // direto = 130; perdas 10% = 13 → 143
    expect(r.costTotal).toBeCloseTo(143, 2);
  });

  it("ignora componentes negativos", () => {
    const r = computeOfficialPricing({
      ...baseInput,
      costs: { acquisition: 100, freight: -50 },
    });
    expect(r.costTotal).toBeCloseTo(100, 2);
  });
});

describe("FASE 4 — taxas Asaas da empresa", () => {
  const table = buildFeeTable([
    {
      method_key: "pix",
      label: "Pix",
      installments: 1,
      fee_percent: 0,
      fee_fixed: 1.99,
      active: true,
    },
    {
      method_key: "debit_card",
      label: "Débito",
      installments: 1,
      fee_percent: 1.89,
      fee_fixed: 0.35,
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
      fee_percent: 3.49,
      fee_fixed: 0.49,
      active: true,
    },
    {
      method_key: "credit_card_3",
      label: "Crédito 3x",
      installments: 3,
      fee_percent: 3.99,
      fee_fixed: 0.49,
      active: true,
    },
  ]);

  it("resolve a taxa cadastrada por método", () => {
    const pix = resolveFee(table, "pix");
    expect(pix.feeFixed).toBeCloseTo(1.99, 2);
    expect(pix.feePct).toBe(0);
  });

  it("usa o pior caso na formação de preço (protege a margem)", () => {
    const worst = worstCaseFee(table, 500);
    expect(worst.feePct).toBeGreaterThanOrEqual(3.99);
  });

  it("converte taxa fixa em percentual efetivo sobre o valor", () => {
    expect(
      effectiveFeePct({ feePct: 0, feeFixed: 1.99, methodKey: "pix", label: "Pix" }, 100),
    ).toBeCloseTo(1.99, 2);
  });

  it("até R$ 100,00 permite somente 1x", () => {
    expect(maxInstallmentsForAmount(INSTALLMENT_MIN_AMOUNT)).toBe(1);
    expect(allowedInstallments(99.9)).toEqual([1]);
  });

  it("acima de R$ 100,00 permite até 3x sem juros", () => {
    expect(maxInstallmentsForAmount(300)).toBe(MAX_INSTALLMENTS_NO_INTEREST);
    expect(allowedInstallments(300)).toEqual([1, 2, 3]);
  });

  it("tabela vazia não quebra o motor", () => {
    expect(worstCaseFee(EMPTY_FEE_TABLE, 100).feePct).toBe(0);
  });

  it("taxa entra na formação e eleva o preço", () => {
    const semTaxa = computeOfficialPricing(baseInput).recommendedPrice;
    const comTaxa = computeOfficialPricing({
      ...baseInput,
      fee: { pct: 3.99, fixed: 0.49 },
    }).recommendedPrice;
    expect(comTaxa).toBeGreaterThan(semTaxa);
  });
});

describe("FASE 5 — políticas por categoria", () => {
  it("respeita a margem alvo da categoria", () => {
    const r = computeOfficialPricing({
      ...baseInput,
      categoryId: "cat-relogios",
      categoryName: "Relógios",
      margins: { minPct: 20, targetPct: 60, premiumPct: 70 },
    });
    expect(r.recommendedPrice).toBeCloseTo(250, 1); // 100 / (1 - 0.6)
  });

  it("teto de margem apenas alerta, nunca corta preço", () => {
    const price = 400;
    const evaluation = evaluateOfficialPrice(price, baseInput);
    const guards = evaluatePriceGuards(price, evaluation, {
      minMarginPct: 10,
      maxMarginPct: 50,
    });
    expect(guards.map((g) => g.code)).toContain("ABOVE_MAX_MARGIN");
    expect(hasBlockingGuard(guards)).toBe(false);
  });
});

describe("FASE 6 — auditoria de preço", () => {
  it("detalha custos, deduções e lucro líquido", () => {
    const r = computeOfficialPricing({
      ...baseInput,
      costs: { acquisition: 100, freight: 10 },
      fee: { pct: 3.99, fixed: 0.49 },
      taxPct: 6,
    });
    const keys = r.audit.map((l) => l.key);
    expect(keys).toEqual(
      expect.arrayContaining(["acquisition", "freight", "fee", "tax", "profit", "final_price"]),
    );
    expect(r.audit.find((l) => l.key === "profit")?.kind).toBe("result");
    expect(r.audit.find((l) => l.key === "tax")?.pct).toBeCloseTo(6, 2);
  });

  it("expõe explicação rastreável do motor canônico", () => {
    const r = computeOfficialPricing(baseInput);
    expect(r.result.explainId).toBeTruthy();
    expect(r.explanation.steps.length).toBeGreaterThan(0);
  });
});

describe("FASE 7 — proteções comerciais", () => {
  const input = { ...baseInput, costs: { acquisition: 100 }, fee: { pct: 4 } };

  it("bloqueia venda abaixo do custo", () => {
    const guards = evaluatePriceGuards(80, evaluateOfficialPrice(80, input), {
      minMarginPct: 10,
    });
    expect(guards.find((g) => g.code === "BELOW_COST")?.severity).toBe("block");
    expect(hasBlockingGuard(guards)).toBe(true);
  });

  it("permite venda abaixo do custo apenas com autorização explícita", () => {
    const guards = evaluatePriceGuards(80, evaluateOfficialPrice(80, input), {
      minMarginPct: 10,
      allowBelowCost: true,
    });
    expect(hasBlockingGuard(guards)).toBe(false);
  });

  it("alerta margem abaixo da mínima sem bloquear", () => {
    const guards = evaluatePriceGuards(105, evaluateOfficialPrice(105, input), {
      minMarginPct: 20,
    });
    expect(guards.map((g) => g.code)).toContain("BELOW_MIN_MARGIN");
    expect(hasBlockingGuard(guards)).toBe(false);
  });

  it("alerta quando a taxa consome o lucro", () => {
    const guards = evaluatePriceGuards(106, evaluateOfficialPrice(106, input), {
      minMarginPct: 0,
    });
    expect(guards.map((g) => g.code)).toContain("FEE_EATS_PROFIT");
  });

  it("preço saudável não gera nenhuma proteção", () => {
    const guards = evaluatePriceGuards(200, evaluateOfficialPrice(200, input), {
      minMarginPct: 10,
      maxMarginPct: 80,
    });
    expect(guards).toEqual([]);
  });
});

describe("FASE 8 — paridade entre módulos", () => {
  it("formação e avaliação usam a mesma matemática", () => {
    const input = { ...baseInput, fee: { pct: 3.5 }, taxPct: 6 };
    const formed = computeOfficialPricing(input);
    const evaluated = evaluateOfficialPrice(formed.targetPrice, input);
    expect(evaluated.costTotal).toBeCloseTo(formed.costTotal, 2);
    expect(evaluated.marginPct).toBeCloseTo(formed.marginPct, 1);
    expect(evaluated.profit).toBeCloseTo(formed.profit, 1);
  });

  it("imposto reduz o lucro líquido no mesmo preço", () => {
    const semImposto = evaluateOfficialPrice(200, baseInput).profit;
    const comImposto = evaluateOfficialPrice(200, { ...baseInput, taxPct: 10 }).profit;
    expect(comImposto).toBeLessThan(semImposto);
  });
});
