import { describe, expect, it } from "vitest";
import { buildBiweeklySummary } from "../biweekly-summary";

const top = [
  { product_id: "a", name: "Bolsa Ana", quantity: 12, revenue: 1200 },
  { product_id: "b", name: "Carteira Arthur", quantity: 5, revenue: 200 },
];

describe("buildBiweeklySummary", () => {
  it("lista os mais vendidos em ordem e a quantidade a repor", () => {
    const summary = buildBiweeklySummary(top, 3);
    expect(summary?.title).toBe("Resumo quinzenal: mais vendidos e reposição");
    expect(summary?.message).toContain("1. Bolsa Ana — 12 un.");
    expect(summary?.message).toContain("2. Carteira Arthur — 5 un.");
    expect(summary?.message.indexOf("Bolsa Ana")).toBeLessThan(
      summary!.message.indexOf("Carteira Arthur"),
    );
    expect(summary?.message).toContain("3 produtos precisam de reposição");
  });

  it("usa singular para um produto a repor", () => {
    expect(buildBiweeklySummary(top, 1)?.message).toContain("1 produto precisa de reposição");
  });

  it("avisa quando não houve venda mas há reposição", () => {
    const summary = buildBiweeklySummary([], 2);
    expect(summary?.message).toContain("Nenhuma venda nos últimos 15 dias.");
    expect(summary?.message).toContain("2 produtos precisam de reposição");
  });

  it("não gera nada sem vendas e sem reposição", () => {
    expect(buildBiweeklySummary([], 0)).toBeNull();
  });
});
