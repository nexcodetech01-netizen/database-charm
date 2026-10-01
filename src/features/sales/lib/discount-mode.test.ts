import { describe, expect, it } from "vitest";
import { percentToValue, valueToPercent } from "./discount-mode";

describe("desconto em %", () => {
  it("converte % em reais arredondando nos centavos", () => {
    expect(percentToValue(59.9, 5)).toBe(3); // 2,995 → 3,00
    expect(percentToValue(109.9, 10)).toBe(10.99);
    expect(percentToValue(100, 0)).toBe(0);
  });

  it("nunca passa do valor da base", () => {
    expect(percentToValue(50, 150)).toBe(50);
    expect(percentToValue(50, -5)).toBe(0);
  });

  it("converte reais em % com 2 casas", () => {
    expect(valueToPercent(59.9, 2.9)).toBe(4.84);
    expect(valueToPercent(0, 10)).toBe(0);
  });
});
