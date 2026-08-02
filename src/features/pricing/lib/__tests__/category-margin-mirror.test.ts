import { describe, expect, it } from "vitest";
import { categoryMarginColumns } from "../category-margin-mirror";

describe("categoryMarginColumns", () => {
  it("mapeia mínima/padrão/máxima para as colunas do motor", () => {
    expect(
      categoryMarginColumns({ minMarginPct: 20, idealMarginPct: 45, premiumMarginPct: 70 }),
    ).toEqual({ min_margin_pct: 20, target_margin_pct: 45, max_margin_pct: 70 });
  });

  it("ignora valores inválidos ou fora da faixa", () => {
    expect(
      categoryMarginColumns({ minMarginPct: -5, idealMarginPct: 120, premiumMarginPct: null }),
    ).toEqual({ min_margin_pct: null, target_margin_pct: null, max_margin_pct: null });
  });

  it("nunca deixa a máxima abaixo da padrão", () => {
    expect(
      categoryMarginColumns({ minMarginPct: 10, idealMarginPct: 50, premiumMarginPct: 30 }),
    ).toEqual({ min_margin_pct: 10, target_margin_pct: 50, max_margin_pct: 50 });
  });
});
