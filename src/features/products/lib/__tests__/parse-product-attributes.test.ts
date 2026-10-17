import { describe, expect, it } from "vitest";
import { parseProductAttributes as p } from "../parse-product-attributes";

describe("separar marca, estampa, cor e tamanho", () => {
  it("camiseta simples", () => {
    expect(p("Camiseta Masculina Premium Nike Preta P")).toEqual({
      brand: "Nike", model: null, color: "Preta", size: "P",
    });
  });

  it("com estampa nas costas", () => {
    expect(p("Camiseta Masculina Premium Nike Costas Just Do It Branca GG")).toEqual({
      brand: "Nike", model: "Costas Just Do It", color: "Branca", size: "GG",
    });
  });

  it("modelo + costas e cor composta", () => {
    expect(p("Camiseta Masculina Premium Nike Jordan + Costas Jordan Azul Marinho G")).toEqual({
      brand: "Nike", model: "Jordan + Costas Jordan", color: "Azul Marinho", size: "G",
    });
  });

  it("marca de duas palavras e cor composta", () => {
    expect(p("Camiseta Masculina Premium Calvin Klein Verde Militar M")).toEqual({
      brand: "Calvin Klein", model: null, color: "Verde Militar", size: "M",
    });
    expect(p("Camiseta Masculina Premium Emporio Armani Off White M")).toEqual({
      brand: "Emporio Armani", model: null, color: "Off White", size: "M",
    });
  });

  it("formato do fornecedor (Tam e travessão)", () => {
    expect(p("Camiseta Masculina Premium BOSS Tam M – CAFÉ COM LEITE")).toMatchObject({
      brand: "Boss", color: "Café com Leite", size: "M",
    });
  });

  it("marca no meio do tipo (Zara Texturizada)", () => {
    expect(p("Camiseta Masculina Texturizada Zara Creme G")).toEqual({
      brand: "Zara", model: null, color: "Creme", size: "G",
    });
  });

  it("não inventa o que não reconhece", () => {
    expect(p("Produto Qualquer")).toEqual({ brand: null, model: null, color: null, size: null });
  });
});

describe("marca Off-White x cor Off White", () => {
  it("separa as duas", () => {
    expect(p("Camiseta Masculina Premium Off-White Marrom M")).toEqual({
      brand: "Off-White", model: null, color: "Marrom", size: "M",
    });
  });
});
