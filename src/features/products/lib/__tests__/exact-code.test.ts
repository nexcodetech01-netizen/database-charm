import { describe, expect, it } from "vitest";
import { preferExactCodeMatch } from "../exact-code";

const rows = [
  { id: "1", sku: "CAM-MAS-PRE-005", barcode: "SEM GTIN" },
  { id: "2", sku: "CAM-MAS-M-005", barcode: "SEM GTIN" },
  { id: "3", sku: "CAM-MAS-G-005", barcode: "7891234567890" },
];

describe("preferExactCodeMatch", () => {
  it("código exato devolve só a peça", () => {
    expect(preferExactCodeMatch(rows, "cam-mas-pre-005 ").map((r) => r.id)).toEqual(["1"]);
  });
  it("código de barras exato devolve só a peça", () => {
    expect(preferExactCodeMatch(rows, "7891234567890").map((r) => r.id)).toEqual(["3"]);
  });
  it("busca por nome continua tolerante", () => {
    expect(preferExactCodeMatch(rows, "camiseta").length).toBe(3);
  });
  it("'SEM GTIN' não conta como código", () => {
    expect(preferExactCodeMatch(rows, "SEM GTIN").length).toBe(3);
  });
});
