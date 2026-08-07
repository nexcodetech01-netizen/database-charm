import { describe, it, expect } from "vitest";
import { payrollQueries } from "./queries/payroll-queries";
import type { FinancialAdvice } from "../advisor/types";

describe("Payroll Queries (Sprint 8.1)", () => {
  const mockAdvice = {
    available: true,
    payroll: {
      available: true,
      suggestedAmount: 5000,
      suggestedRate: 30,
    },
    reserve: {
      available: true,
      recommended: 3000,
    },
    risk: {
      label: "Baixo",
      score: 20,
    }
  } as unknown as FinancialAdvice;

  it("should format suggested payroll query correctly", () => {
    const res = payrollQueries.prolaboreSugerido(mockAdvice);
    expect(res.value).toBe(5000);
    expect(res.text).toContain("5.000,00");
    expect(res.text).toContain("30%");
  });

  it("should handle unavailable payroll data", () => {
    const unavailableAdvice = { payroll: { available: false } } as any;
    const res = payrollQueries.prolaboreSugerido(unavailableAdvice);
    expect(res.available).toBe(false);
  });
});
