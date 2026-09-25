import { describe, expect, it } from "vitest";
import { applyProductSearch } from "./product-search";

describe("applyProductSearch", () => {
  it("não pesquisa o marcador SEM GTIN no campo barcode", () => {
    const filters: string[] = [];
    const query = {
      or(filter: string) {
        filters.push(filter);
        return this;
      },
    };
    applyProductSearch(query, "sem gtin");
    expect(filters).toHaveLength(2);
    expect(filters.every((filter) => !filter.includes("barcode"))).toBe(true);
  });
});