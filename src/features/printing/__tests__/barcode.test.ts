import { describe, expect, it } from "vitest";
import {
  encodeCode128,
  pickCode128Subset,
  renderCode128Svg,
  sanitizeCode128,
} from "../lib/barcode";

describe("Code 128", () => {
  it("escolhe subset C para dígitos pares e B nos demais casos", () => {
    expect(pickCode128Subset("1234")).toBe("C");
    expect(pickCode128Subset("123")).toBe("B");
    expect(pickCode128Subset("SKU-01")).toBe("B");
  });

  it("calcula o checksum conhecido de 'CODE128' (subset B)", () => {
    // start B (104) + C(35)*1 + O(47)*2 + D(36)*3 + E(37)*4 + 1(17)*5
    // + 2(18)*6 + 8(24)*7 = 850 → 850 % 103 = 26
    const { subset, checksum } = encodeCode128("CODE128");
    expect(subset).toBe("B");
    expect(checksum).toBe(26);
  });

  it("codifica em subset C com metade dos símbolos", () => {
    const b = encodeCode128("12345");
    const c = encodeCode128("123456");
    expect(c.subset).toBe("C");
    // C: start + 3 pares + checksum + stop = 11*5 + 13 = 68 módulos
    expect(c.modules.length).toBe(68);
    expect(b.modules.length).toBeGreaterThan(c.modules.length);
  });

  it("inicia com o padrão de start e termina com o stop", () => {
    const { modules } = encodeCode128("ABC");
    expect(modules.startsWith("11010010000")).toBe(true); // start B
    expect(modules.endsWith("1100011101011")).toBe(true); // stop
  });

  it("remove caracteres não imprimíveis", () => {
    expect(sanitizeCode128("AB\u0001C\n")).toBe("ABC");
  });

  it("lança quando o valor fica vazio", () => {
    expect(() => encodeCode128("\u0000")).toThrow();
  });

  it("gera SVG com viewBox e barras", () => {
    const svg = renderCode128Svg("7891234567895");
    expect(svg).toContain("<svg");
    expect(svg).toContain("viewBox=");
    expect(svg).toContain("<rect");
    expect(svg).toContain("7891234567895");
  });

  it("omite o texto legível quando solicitado", () => {
    const svg = renderCode128Svg("ABC", { displayValue: false });
    expect(svg).not.toContain("<text");
  });
});
