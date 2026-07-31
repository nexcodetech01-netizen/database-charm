import { describe, expect, it } from "vitest";
import { toTitleCasePtBr } from "../text-format";

describe("toTitleCasePtBr", () => {
  it("capitaliza palavras preservando acentos", () => {
    expect(toTitleCasePtBr("são joão do triunfo")).toBe("São João do Triunfo");
  });
  it("mantém preposições em minúsculo no meio", () => {
    expect(toTitleCasePtBr("bolsa de couro e cristal")).toBe("Bolsa de Couro e Cristal");
  });
  it("colapsa espaços e faz trim", () => {
    expect(toTitleCasePtBr("  maria   silva  ")).toBe("Maria Silva");
  });
  it("não altera numéricos", () => {
    expect(toTitleCasePtBr("12345")).toBe("12345");
  });
  it("preserva hífen", () => {
    expect(toTitleCasePtBr("são josé dos campos-norte")).toBe("São José dos Campos-Norte");
  });
  it("capitaliza última palavra mesmo se for preposição", () => {
    expect(toTitleCasePtBr("caminho de")).toBe("Caminho De");
  });
});
