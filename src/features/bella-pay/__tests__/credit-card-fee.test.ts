import { describe, it, expect } from "vitest";
import {
  clampInstallments,
  computeCreditCardCharge,
  CREDIT_CARD_MAX_INSTALLMENTS,
} from "../lib/credit-card-fee";

describe("credit-card-fee (PDV-010)", () => {
  it("nunca ultrapassa 3 parcelas", () => {
    expect(
      clampInstallments(10, { maxInstallments: 3 }),
    ).toBe(CREDIT_CARD_MAX_INSTALLMENTS);
    expect(clampInstallments(2, { maxInstallments: 3 })).toBe(2);
    expect(clampInstallments(0, { maxInstallments: 3 })).toBe(1);
  });

  it("sem absorção envia exatamente o valor da venda", () => {
    const r = computeCreditCardCharge(300, 3, {
      absorb: false,
      feePercent: 3.99,
      maxInstallments: 3,
    });
    expect(r.chargedValue).toBe(300);
    expect(r.addedFee).toBe(0);
    expect(r.installmentValue).toBe(100);
    expect(r.installmentCount).toBe(3);
  });

  it("com absorção acrescenta o percentual configurado", () => {
    const r = computeCreditCardCharge(300, 2, {
      absorb: true,
      feePercent: 3,
      maxInstallments: 3,
    });
    // 300 * 1.03 = 309
    expect(r.chargedValue).toBe(309);
    expect(r.addedFee).toBe(9);
    expect(r.installmentValue).toBe(154.5);
    expect(r.installmentCount).toBe(2);
  });

  it("1x = valor único", () => {
    const r = computeCreditCardCharge(150, 1, {
      absorb: false,
      feePercent: 0,
      maxInstallments: 3,
    });
    expect(r.installmentCount).toBe(1);
    expect(r.installmentValue).toBe(150);
  });

  it("valor zero é seguro", () => {
    const r = computeCreditCardCharge(0, 3, {
      absorb: true,
      feePercent: 5,
      maxInstallments: 3,
    });
    expect(r.chargedValue).toBe(0);
    expect(r.installmentValue).toBe(0);
  });
});
