import { describe, expect, it } from "vitest";
import { toSalePaymentMethod, type UiCheckoutMethod } from "./types";

/** Espelha a constraint `sales_payment_method_check` (public.sales). */
const SALES_PAYMENT_METHOD_CHECK = new Set([
  "pix", "pix_manual", "cash", "card", "credit_card", "debit_card",
  "payment_link", "bella_pay", "a_receber", "credit",
]);

describe("toSalePaymentMethod", () => {
  it("grava boleto como payment_link", () => {
    expect(toSalePaymentMethod("boleto")).toBe("payment_link");
  });

  it("mantém os demais métodos", () => {
    expect(toSalePaymentMethod("cash")).toBe("cash");
    expect(toSalePaymentMethod("credit_card")).toBe("credit_card");
    expect(toSalePaymentMethod("pix_manual")).toBe("pix_manual");
  });

  it("todo método gravável do checkout passa na constraint da venda", () => {
    const methods: UiCheckoutMethod[] = [
      "pix_manual", "credit_card", "payment_link", "boleto",
      "cash", "debit_card", "credit",
    ];
    for (const m of methods) {
      expect(SALES_PAYMENT_METHOD_CHECK.has(toSalePaymentMethod(m))).toBe(true);
    }
  });
});
