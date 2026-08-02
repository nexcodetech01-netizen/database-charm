/**
 * Deduplicação de produtos — nomes com hífen/travessão.
 *
 * Garante que "Arthur - Preto", "Arthur — Preto", "Arthur – Preto" e
 * "Arthur Preto" sejam considerados o MESMO produto (sem duplicata).
 */
import { describe, it, expect } from "vitest";
import { findDuplicateProduct, normalizeForMatch } from "../product-dedupe";

interface Row {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  cost: number | null;
}

/** Converte um padrão `ilike` (com % como curinga) em RegExp case-insensitive. */
function ilikeToRegex(pattern: string): RegExp {
  const unescaped = pattern.replace(/\\([%_\\])/g, "$1__LITERAL__");
  const source = unescaped
    .split("%")
    .map((part) =>
      part.replace(/__LITERAL__/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join(".*");
  return new RegExp(`^${source}$`, "i");
}

/** Client Supabase falso que aplica `ilike` sobre um conjunto de linhas. */
function makeClient(rows: Row[]) {
  const calls: Array<{ column: string; pattern: string }> = [];
  const client = {
    from() {
      let column = "";
      let pattern = "";
      let ignoreId: string | null = null;
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        neq: (_col: string, id: string) => {
          ignoreId = id;
          return chain;
        },
        ilike: (col: string, pat: string) => {
          column = col;
          pattern = pat;
          calls.push({ column: col, pattern: pat });
          return chain;
        },
        then: (
          resolve: (value: { data: Row[]; error: null }) => unknown,
        ) => {
          const re = ilikeToRegex(pattern);
          const data = rows
            .filter((r) => r.id !== ignoreId)
            .filter((r) => {
              const value = (r as unknown as Record<string, string | null>)[column];
              return typeof value === "string" && re.test(value);
            })
            .slice(0, 1);
          return Promise.resolve(resolve({ data, error: null }));
        },
      };
      return chain;
    },
  };
  return { client, calls };
}

const baseRow: Row = {
  id: "p1",
  name: "Arthur - Preto",
  sku: "ART-PRETO",
  barcode: null,
  price: 199.9,
  cost: 100,
};

describe("product-dedupe — hífen e travessão", () => {
  it("normalizeForMatch trata -, – e — como espaço", () => {
    expect(normalizeForMatch("Arthur - Preto")).toBe("arthur preto");
    expect(normalizeForMatch("Arthur – Preto")).toBe("arthur preto");
    expect(normalizeForMatch("Arthur — Preto")).toBe("arthur preto");
    expect(normalizeForMatch("  ARTHUR—PRETO  ")).toBe("arthur preto");
  });

  it.each([
    ["Arthur - Preto"],
    ["Arthur – Preto"],
    ["Arthur — Preto"],
    ["Arthur Preto"],
    ["arthur—preto"],
    ["  Arthur   -   Preto "],
  ])("encontra duplicata para %s", async (name) => {
    const { client } = makeClient([baseRow]);
    const found = await findDuplicateProduct("c1", { name }, undefined, client);
    expect(found).not.toBeNull();
    expect(found?.id).toBe("p1");
    expect(found?.matchedBy).toBe("name");
  });

  it("preserva price/cost do produto existente no retorno", async () => {
    const { client } = makeClient([baseRow]);
    const found = await findDuplicateProduct(
      "c1",
      { name: "Arthur — Preto" },
      undefined,
      client,
    );
    expect(found?.price).toBe(199.9);
    expect(found?.cost).toBe(100);
  });

  it("não confunde produtos diferentes com hífen", async () => {
    const { client } = makeClient([baseRow]);
    const found = await findDuplicateProduct(
      "c1",
      { name: "Arthur - Branco" },
      undefined,
      client,
    );
    expect(found).toBeNull();
  });

  it("ignora o próprio produto ao editar (ignoreProductId)", async () => {
    const { client } = makeClient([baseRow]);
    const found = await findDuplicateProduct(
      "c1",
      { name: "Arthur — Preto" },
      "p1",
      client,
    );
    expect(found).toBeNull();
  });

  it("SKU tem precedência sobre o nome", async () => {
    const { client, calls } = makeClient([baseRow]);
    const found = await findDuplicateProduct(
      "c1",
      { name: "Outro Nome", sku: "ART-PRETO" },
      undefined,
      client,
    );
    expect(found?.matchedBy).toBe("sku");
    expect(calls[0]?.column).toBe("sku");
  });
});
