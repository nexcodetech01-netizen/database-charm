import { describe, expect, it } from "vitest";
import { buildProductName, describeVariant, sameProductIdentity } from "../product-identity";

describe("identidade do produto (aviso de duplicado)", () => {
  it("mesmo nome, estampa diferente: não é duplicado", () => {
    expect(
      sameProductIdentity(
        { name: "Camiseta Nike Azul", model: "Just Do It", color: "Azul", size: "M" },
        { name: "Camiseta Nike Azul", model: "Swoosh", color: "Azul", size: "M" },
      ),
    ).toBe(false);
  });

  it("mesmo nome, tamanho diferente: não é duplicado", () => {
    expect(
      sameProductIdentity(
        { name: "Camiseta Nike", color: "Azul", size: "M" },
        { name: "camiseta nike", color: "azul", size: "G" },
      ),
    ).toBe(false);
  });

  it("tudo igual (ignorando acento/maiúscula e 'Padrão'): é duplicado", () => {
    expect(
      sameProductIdentity(
        { name: "Camiseta Básica", model: "Padrão", color: "Azul", size: "M" },
        { name: "camiseta basica", model: "", color: "AZUL", size: "m" },
      ),
    ).toBe(true);
  });

  it("monta o nome sem repetir partes", () => {
    expect(
      buildProductName({ name: "Camiseta", brand: "Nike", model: "Just Do It", color: "Azul", size: "M" }),
    ).toBe("Camiseta Nike Just Do It Azul M");
    expect(
      buildProductName({ name: "Camiseta Nike Azul", brand: "Nike", model: "Padrão", color: "azul", size: "G" }),
    ).toBe("Camiseta Nike Azul G");
    expect(buildProductName({ brand: "Genérico", color: "Preta", size: "P" })).toBe("Preta P");
  });

  it("descreve a variação para listas", () => {
    expect(describeVariant({ model: "Padrão", color: "Azul", size: "M" })).toBe("Azul · M");
  });
});
