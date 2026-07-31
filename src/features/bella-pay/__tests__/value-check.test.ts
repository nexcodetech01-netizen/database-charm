import { describe, it, expect } from "vitest";
import { checkPaymentValue } from "../lib/value-check";

describe("value-check (P1-07)", () => {
  it("valores idênticos passam", () => {
    expect(checkPaymentValue(100, 100).ok).toBe(true);
  });

  it("diferença dentro da tolerância (±0.01) passa", () => {
    expect(checkPaymentValue(100, 100.01).ok).toBe(true);
    expect(checkPaymentValue(100, 99.99).ok).toBe(true);
  });

  it("diferença acima da tolerância falha", () => {
    const r = checkPaymentValue(100, 100.02);
    expect(r.ok).toBe(false);
    expect(r.diff).toBeCloseTo(0.02, 4);
  });

  it("centavos ausentes falham", () => {
    expect(checkPaymentValue(100, 99).ok).toBe(false);
  });

  it("tolerância customizada", () => {
    expect(checkPaymentValue(100, 100.5, 1).ok).toBe(true);
  });
});
