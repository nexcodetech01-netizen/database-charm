import { describe, expect, it } from "vitest";

/**
 * BUGFIX-001 — payment method constraint contract test.
 *
 * Mirrors the CHECK constraint `sales_payment_method_check` on `public.sales`.
 * If this list ever diverges from the DB constraint, sales will fail with a
 * 23514 error at runtime. Update both in the same migration.
 */
const ALLOWED_PAYMENT_METHODS = [
  "pix",
  "pix_manual",
  "cash",
  "credit_card",
  "debit_card",
  "payment_link",
  "card", // legacy
  "bella_pay", // legacy
] as const;


function isAllowedPaymentMethod(value: string): boolean {
  return (ALLOWED_PAYMENT_METHODS as readonly string[]).includes(value);
}

describe("sales.payment_method constraint", () => {
  it.each(ALLOWED_PAYMENT_METHODS)("accepts %s", (method) => {
    expect(isAllowedPaymentMethod(method)).toBe(true);
  });

  it("keeps legacy card compatibility", () => {
    expect(isAllowedPaymentMethod("card")).toBe(true);
  });

  it("keeps legacy bella_pay compatibility", () => {
    expect(isAllowedPaymentMethod("bella_pay")).toBe(true);
  });

  it("rejects unknown methods", () => {
    expect(isAllowedPaymentMethod("boleto")).toBe(false);
    expect(isAllowedPaymentMethod("")).toBe(false);
    expect(isAllowedPaymentMethod("CREDIT_CARD")).toBe(false);
  });
});
