import { describe, expect, it } from "vitest";
import { clamp, ok, ratio, readSafely, safeDivide, unavailable, currentPeriod } from "../lib/helpers";
import { computeFinancialHealth, levelFromScore } from "../lib/health";
import { PAYROLL_POLICY, suggestPayroll } from "../lib/payroll";

describe("accounting-ai · helpers", () => {
  it("safeDivide nunca divide por zero", () => {
    expect(safeDivide(10, 0)).toBe(0);
    expect(safeDivide(10, 4)).toBe(2.5);
  });

  it("ratio devolve percentual", () => {
    expect(ratio(25, 100)).toBe(25);
    expect(ratio(1, 0)).toBe(0);
  });

  it("clamp limita o intervalo", () => {
    expect(clamp(120, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it("currentPeriod devolve datas ISO do mês", () => {
    const p = currentPeriod(new Date(2026, 1, 15));
    expect(p.start).toBe("2026-02-01");
    expect(p.end).toBe("2026-02-28");
  });

  it("ok/unavailable produzem envelopes coerentes", () => {
    expect(ok(1, "accounting").available).toBe(true);
    const u = unavailable<number>("finance");
    expect(u.available).toBe(false);
    expect(u.data).toBeNull();
  });

  it("readSafely degrada em vez de lançar", async () => {
    const res = await readSafely("sales", async () => {
      throw new Error("boom");
    });
    expect(res.available).toBe(false);
    expect(res.source).toBe("sales");
  });
});

describe("accounting-ai · health", () => {
  it("classifica saúde por score", () => {
    expect(levelFromScore(90)).toBe("healthy");
    expect(levelFromScore(50)).toBe("attention");
    expect(levelFromScore(10)).toBe("critical");
  });

  it("penaliza liquidez baixa e margem negativa", () => {
    const h = computeFinancialHealth({
      liquidity: 0.5,
      workingCapital: -100,
      debtRatio: 80,
      netMargin: -5,
    });
    expect(h.level).toBe("critical");
    expect(h.score).toBeLessThan(40);
    expect(h.reasons.length).toBeGreaterThanOrEqual(4);
  });

  it("empresa saudável mantém score alto", () => {
    const h = computeFinancialHealth({
      liquidity: 2,
      workingCapital: 5000,
      debtRatio: 20,
      netMargin: 18,
    });
    expect(h.level).toBe("healthy");
    expect(h.score).toBe(100);
  });
});

describe("accounting-ai · payroll", () => {
  const period = { start: "2026-01-01", end: "2026-01-31" };

  it("sugere pró-labore e reserva sobre o lucro", () => {
    const s = suggestPayroll(period, 10000);
    expect(s.suggestedAmount).toBeCloseTo(10000 * PAYROLL_POLICY.payrollRate);
    expect(s.reserveAmount).toBeCloseTo(10000 * PAYROLL_POLICY.reserveRate);
    expect(s.distributableProfit).toBeCloseTo(5000);
    expect(s.confident).toBe(true);
  });

  it("não sugere retirada com prejuízo", () => {
    const s = suggestPayroll(period, -2000);
    expect(s.basis).toBe(0);
    expect(s.suggestedAmount).toBe(0);
    expect(s.confident).toBe(false);
  });
});
