import { describe, expect, it } from "vitest";
import {
  formatCategoriesMessage,
  formatProductsMessage,
  isBackIntent,
  isCatalogIntent,
  matchCategory,
} from "../catalog-nav";

const cats = [
  { id: "a", name: "Bolsas", icon: "ShoppingBag", productCount: 3 },
  { id: "b", name: "Carteiras", icon: "Tag", productCount: 1 },
  { id: "c", name: "Perfumes", icon: "Star", productCount: 2 },
];

describe("catalog-nav", () => {
  it("detecta intenção de catálogo", () => {
    expect(isCatalogIntent("Quero ver o catálogo")).toBe(true);
    expect(isCatalogIntent("bom dia")).toBe(false);
  });

  it("detecta voltar", () => {
    expect(isBackIntent("voltar")).toBe(true);
    expect(isBackIntent("categorias")).toBe(true);
  });

  it("casa categoria por nome e por número", () => {
    expect(matchCategory("Bolsas", cats)?.id).toBe("a");
    expect(matchCategory("bolsas", cats)?.id).toBe("a");
    expect(matchCategory("3", cats)?.id).toBe("c");
    expect(matchCategory("xyz", cats)).toBeNull();
  });

  it("formata categorias com emoji e numeração", () => {
    const msg = formatCategoriesMessage(cats);
    expect(msg).toContain("1. 👜 Bolsas");
    expect(msg).toContain("3. ⭐ Perfumes");
  });

  it("lista produtos com opção de voltar", () => {
    const msg = formatProductsMessage("Bolsas", [
      { id: "p1", name: "Bolsa Couro", price: 199.9, unit: "un" },
    ]);
    expect(msg).toContain("Bolsa Couro");
    expect(msg.toLowerCase()).toContain("gostou de algum desses modelos");
  });

  it("mensagem vazia quando não há categorias", () => {
    expect(formatCategoriesMessage([])).toMatch(/não temos produtos/i);
  });
});
