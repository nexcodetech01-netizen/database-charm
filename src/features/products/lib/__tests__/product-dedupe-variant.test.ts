/**
 * Deduplicação — nome igual com cor/tamanho/modelo diferentes não é duplicado.
 */
import { describe, expect, it } from "vitest";
import { findDuplicateProduct } from "../product-dedupe";

type Row = Record<string, string | number | null>;

function makeClient(rows: Row[]) {
  return {
    from() {
      let column = "";
      let pattern = "";
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        neq: () => chain,
        ilike: (col: string, pat: string) => {
          column = col;
          pattern = pat.replace(/%/g, " ").toLowerCase();
          return chain;
        },
        then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
          Promise.resolve(
            resolve({
              data: rows.filter((r) => String(r[column] ?? "").toLowerCase() === pattern),
              error: null,
            }),
          ),
      };
      return chain;
    },
  };
}

const rows: Row[] = [
  { id: "a", name: "Camiseta Nike Azul", sku: "A", barcode: null, price: 1, cost: 1, status: "active", model: "Just Do It", color: "Azul", size: "M" },
  { id: "b", name: "Camiseta Nike Azul", sku: "B", barcode: null, price: 1, cost: 1, status: "active", model: "Swoosh", color: "Azul", size: "M" },
];

describe("dedupe por identidade", () => {
  it("estampa diferente não é duplicado", async () => {
    const d = await findDuplicateProduct(
      "c1",
      { name: "Camiseta Nike Azul", model: "Retrô", color: "Azul", size: "M" },
      undefined,
      makeClient(rows),
    );
    expect(d).toBeNull();
  });

  it("mesma identidade é duplicado e informa a variação", async () => {
    const d = await findDuplicateProduct(
      "c1",
      { name: "camiseta nike azul", model: "swoosh", color: "azul", size: "m" },
      undefined,
      makeClient(rows),
    );
    expect(d?.id).toBe("b");
    expect(d?.variant).toBe("Swoosh · Azul · M");
    expect(d?.ambiguous).toBe(false);
  });

  it("só o nome, com variações diferentes cadastradas: ambíguo", async () => {
    const d = await findDuplicateProduct("c1", { name: "Camiseta Nike Azul" }, undefined, makeClient(rows));
    expect(d?.ambiguous).toBe(true);
  });
});
