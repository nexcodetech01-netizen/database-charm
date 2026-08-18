import { describe, it, expect } from "vitest";
import { parseCurrency } from "@/lib/masks";

describe("Monetary Consistency and Parsing", () => {
  it("TESTE F — FORMATAÇÃO BRASILEIRA", () => {
    expect(parseCurrency("40,00")).toBe(40);
    expect(parseCurrency("1.234,56")).toBe(1234.56);
    expect(parseCurrency("R$ 40,00")).toBe(40);
    expect(parseCurrency("R$ 1.234,56")).toBe(1234.56);
    expect(parseCurrency("50")).toBe(50);
    expect(parseCurrency("50,00")).toBe(50);
    expect(parseCurrency("R$ 50,00")).toBe(50);
    
    // Casos complexos
    expect(parseCurrency("R$ 4.000,00")).toBe(4000);
    expect(parseCurrency("4.000")).toBe(4000);
    expect(parseCurrency("4.000,00")).toBe(4000);
    
    // O problema original: "R$ 40,00" -> 4000? 
    // Com parseCurrency corrigido, deve ser 40.
    const inputProblem = "R$ 40,00";
    const result = parseCurrency(inputProblem);
    expect(result).toBe(40);
  });

  it("TESTE H — PREÇO DO CATÁLOGO", () => {
    // "Carteira Masculina Texturizada - Arthur — Azul — 1 un. — R$ 40,00"
    const pricePart = "R$ 40,00";
    const unitPrice = parseCurrency(pricePart);
    const qty = 1;
    const subtotal = unitPrice * qty;
    
    expect(unitPrice).toBe(40);
    expect(subtotal).toBe(40);
    expect(subtotal).not.toBe(4000);
  });
});
