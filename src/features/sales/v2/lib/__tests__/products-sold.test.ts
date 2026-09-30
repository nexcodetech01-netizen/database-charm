import { describe, expect, it } from "vitest";
import { buildProductsSoldMessage, resolveSoldPeriod } from "../products-sold";
import { detectDeterministicIntent } from "@/features/bella-ai/agent/intent-engine";

const row = (over: Partial<Parameters<typeof buildProductsSoldMessage>[2][number]>) => ({
  product_id: "p",
  name: "Perfume",
  category: "Perfumes",
  quantity: 0,
  revenue: 0,
  stock: 0,
  sold_60d: 0,
  suggested_qty: 0,
  ...over,
});

describe("intenção 'quantos X vendi'", () => {
  it.each([
    ["quantos perfumes eu vendi esse mes pra poder repor", "perfumes", "this_month"],
    ["Quantas bolsas vendemos no mês passado?", "bolsas", "last_month"],
    ["quais carteiras mais venderam", "carteiras", "this_month"],
    ["vendas de perfume esse mês", "perfume", "this_month"],
  ])("%s", (text, term, period) => {
    const intent = detectDeterministicIntent(text);
    expect(intent?.id).toBe("sale.products_sold");
    expect(intent?.entities).toEqual({ term, period });
  });

  it("'quanto vendi' (valor) continua sendo busca de vendas", () => {
    expect(detectDeterministicIntent("quanto vendi hoje")?.id).toBe("sale.search");
  });
});

describe("resposta", () => {
  it("soma unidades, lista produtos e mostra o que repor", () => {
    const msg = buildProductsSoldMessage("perfumes", "em setembro", [
      row({ name: "Perfume Escândalos", quantity: 2, revenue: 180, stock: 0, suggested_qty: 1 }),
      row({ name: "Perfume Selvagem", quantity: 1, revenue: 90, stock: 2 }),
    ]);
    expect(msg).toContain('Em setembro você vendeu 3 un. de "perfumes"');
    expect(msg).toContain("• Perfume Escândalos — 2 un. · estoque 0");
    expect(msg).toContain("Pra repor (giro dos últimos 60 dias");
    expect(msg).toContain("• Perfume Escândalos — comprar 1 un.");
    expect(msg).not.toContain("Perfume Selvagem — comprar");
  });

  it("sem vendas no período avisa e ainda sugere reposição pelo giro", () => {
    const msg = buildProductsSoldMessage("perfumes", "em outubro", [
      row({ name: "Perfume Gosth Girl", sold_60d: 2, suggested_qty: 1 }),
    ]);
    expect(msg).toContain('Não encontrei vendas de "perfumes" em outubro.');
    expect(msg).toContain("comprar 1 un.");
  });
});

describe("resolveSoldPeriod", () => {
  it("mês atual e mês passado", () => {
    const now = new Date(2026, 9, 1); // 1º de outubro
    expect(resolveSoldPeriod("this_month", now)).toEqual({ start: "2026-10-01", end: "2026-10-01", label: "em outubro" });
    expect(resolveSoldPeriod("last_month", now)).toEqual({ start: "2026-09-01", end: "2026-09-30", label: "em setembro" });
  });
});
