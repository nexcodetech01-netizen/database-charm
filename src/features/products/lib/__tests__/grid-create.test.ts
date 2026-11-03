import { describe, expect, it } from "vitest";
import {
  emptyGroup,
  gridSummary,
  parseMoney,
  validateGroups,
  type GridGroup,
} from "../grid-create";

const group = (over: Partial<GridGroup> = {}): GridGroup => ({
  ...emptyGroup(),
  name: "Camiseta Masculina Peruana Pima",
  categoryId: "vest",
  cost: "23,90",
  price: "89,90",
  rows: [
    { key: "a", brand: "Gucci", color: "Off-White", size: "M", quantity: "1" },
    { key: "b", brand: "Emporio Armani", color: "Preta", size: "M", quantity: "1" },
  ],
  ...over,
});

describe("cadastro em grade", () => {
  it("lê valores em reais", () => {
    expect(parseMoney("23,90")).toBe(23.9);
    expect(parseMoney("R$ 1.234,50")).toBe(1234.5);
    expect(parseMoney("")).toBe(0);
  });

  it("soma peças e o valor da compra com frete (nota da Vest Fácil)", () => {
    const groups = [
      group({
        cost: "16,90",
        rows: [
          { key: "1", brand: "A", color: "X", size: "M", quantity: "4" },
          { key: "2", brand: "A", color: "X", size: "G", quantity: "3" },
          { key: "3", brand: "A", color: "X", size: "GG", quantity: "4" },
        ],
      }),
      group({
        cost: "27,90",
        rows: [
          { key: "4", brand: "B", color: "Y", size: "G", quantity: "3" },
          { key: "5", brand: "B", color: "Y", size: "GG", quantity: "4" },
        ],
      }),
      group({
        cost: "23,90",
        rows: [{ key: "6", brand: "C", color: "Z", size: "M", quantity: "2" }],
      }),
      group({
        name: "Bermuda Jeans Masculina",
        cost: "33,90",
        rows: [
          { key: "7", brand: "D", color: "Azul", size: "42", quantity: "1" },
          { key: "8", brand: "D", color: "Azul", size: "44", quantity: "1" },
          { key: "9", brand: "D", color: "Azul", size: "46", quantity: "1" },
        ],
      }),
    ];
    const s = gridSummary(groups, 32.72);
    expect(s.pieces).toBe(23);
    expect(s.items).toBe(530.7);
    expect(s.total).toBe(563.42);
  });

  it("aponta o que falta", () => {
    expect(validateGroups([group()])).toBeNull();
    expect(validateGroups([group({ price: "" })])).toMatch(/preço/);
    expect(validateGroups([group({ categoryId: "" })])).toMatch(/categoria/);
    expect(
      validateGroups([
        group({
          rows: [
            { key: "a", brand: "Gucci", color: "Preta", size: "M", quantity: "1" },
            { key: "b", brand: "gucci", color: "preta", size: "m", quantity: "2" },
          ],
        }),
      ]),
    ).toMatch(/duas vezes/);
    expect(
      validateGroups([
        group({ rows: [{ key: "a", brand: "", color: "", size: "", quantity: "0" }] }),
      ]),
    ).toMatch(/ao menos uma linha/);
  });
});

import { vi } from "vitest";
import { runGridCreate, type GridCreateDeps } from "../grid-create";
import { buildProductName, describeVariant } from "../product-identity";

function deps(existing: Record<string, string> = {}) {
  const createProduct = vi.fn(async (p: Record<string, unknown>) => ({
    id: `new-${String(p.brand)}-${String(p.size)}`,
  }));
  const createPurchase = vi.fn(async (_p: Record<string, unknown>) => ({}));
  const d: GridCreateDeps = {
    findExisting: async ({ name, color, size }) => existing[`${name}|${color}|${size}`] ?? null,
    generateSku: async () => "SKU",
    createProduct,
    createPurchase,
    resolveSupplier: async () => "sup1",
    buildName: buildProductName,
    describe: describeVariant,
  };
  return { d, createProduct, createPurchase };
}

describe("runGridCreate", () => {
  it("cria um produto por linha, estoque 0, e uma compra pendente com tudo e o frete", async () => {
    const { d, createProduct, createPurchase } = deps();
    const res = await runGridCreate(
      {
        companyId: "c",
        groups: [group({ model: "Minimalista" })],
        withPurchase: true,
        shipping: 32.72,
        purchaseDate: "2026-10-29",
        purchaseNumber: "PC-1",
      },
      d,
    );
    expect(res).toEqual({ createdCount: 2, reused: 0, purchaseNumber: "PC-1" });
    expect(createProduct.mock.calls[0][0]).toMatchObject({
      name: "Camiseta Masculina Peruana Pima Gucci",
      brand: "Gucci",
      model: "Minimalista",
      color: "Off-White",
      size: "M",
      cost: 23.9,
      price: 89.9,
      stock: 0,
    });
    const purchase = createPurchase.mock.calls[0][0] as {
      status: string;
      shipping: number;
      items: unknown[];
    };
    expect(purchase.status).toBe("pending");
    expect(purchase.shipping).toBe(32.72);
    expect(purchase.items).toHaveLength(2);
  });

  it("sem compra, a quantidade entra no estoque", async () => {
    const { d, createProduct, createPurchase } = deps();
    await runGridCreate(
      {
        companyId: "c",
        groups: [group()],
        withPurchase: false,
        shipping: 0,
        purchaseDate: "",
        purchaseNumber: "",
      },
      d,
    );
    expect(createProduct.mock.calls[0][0]).toMatchObject({ stock: 1 });
    expect(createPurchase).not.toHaveBeenCalled();
  });

  it("peça que já existe não é duplicada; entra só na compra", async () => {
    const { d, createProduct, createPurchase } = deps({
      "Camiseta Masculina Peruana Pima Gucci|Off-White|M": "old-1",
    });
    const res = await runGridCreate(
      {
        companyId: "c",
        groups: [group()],
        withPurchase: true,
        shipping: 0,
        purchaseDate: "2026-10-29",
        purchaseNumber: "PC-2",
      },
      d,
    );
    expect(res.reused).toBe(1);
    expect(createProduct).toHaveBeenCalledTimes(1);
    const items = (createPurchase.mock.calls[0][0] as { items: { product_id: string }[] }).items;
    expect(items.map((i) => i.product_id)).toContain("old-1");
  });
});
