import { describe, expect, it } from "vitest";
import { inferCategoryName } from "../infer-category";

describe("categoria automática — roupas", () => {
  it.each([
    "Camiseta Masculina Premium Nike Preta P",
    "Camiseta Masculina Texturizada Zara Creme G",
    "Camisa Social Slim Branca M",
    "Bermuda Tactel Azul 42",
    "Calça Jeans Skinny 38",
    "Vestido Midi Floral",
  ])("%s → Vestuário", (name) => {
    expect(inferCategoryName(name)).toBe("Vestuário");
  });

  it("bolsas continuam bolsas", () => {
    expect(inferCategoryName("Bolsa Transversal Couro Preta")).toBe("Bolsa Transversal");
    expect(inferCategoryName("Bolsa Jeans Média")).toBe("Bolsa");
    expect(inferCategoryName("Bolsa Meia Lua Caramelo")).toBe("Bolsa");
    expect(inferCategoryName("Mochila Escolar")).toBe("Mochila");
  });
});
