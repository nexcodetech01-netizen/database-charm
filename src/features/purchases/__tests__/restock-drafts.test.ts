import { describe, expect, it } from "vitest";
import { groupRestockBySupplier, restockUnitCost } from "../services/restock-drafts";

const products = [
  { id: "p1", name: "Bolsa", supplier_id: "s1", last_purchase_cost: 50, cost: 40 },
  { id: "p2", name: "Carteira", supplier_id: "s2", last_purchase_cost: null, cost: 20 },
  { id: "p3", name: "Chaveiro", supplier_id: null, last_purchase_cost: null, cost: 0 },
  { id: "p4", name: "Cinto", supplier_id: "s1", last_purchase_cost: 0, cost: 30 },
];

describe("restockUnitCost", () => {
  it("prefere o último custo de compra, depois o custo cadastrado", () => {
    expect(restockUnitCost(products[0])).toBe(50);
    expect(restockUnitCost(products[1])).toBe(20);
    expect(restockUnitCost(products[3])).toBe(30);
    expect(restockUnitCost(products[2])).toBe(0);
    expect(restockUnitCost(undefined)).toBe(0);
  });
});

describe("groupRestockBySupplier", () => {
  it("gera um grupo por fornecedor, com produtos sem fornecedor por último", () => {
    const groups = groupRestockBySupplier(
      [
        { productId: "p3", name: "Chaveiro", quantity: 2 },
        { productId: "p1", name: "Bolsa", quantity: 3 },
        { productId: "p2", name: "Carteira", quantity: 1 },
        { productId: "p4", name: "Cinto", quantity: 4 },
      ],
      products,
    );
    expect(groups.map((g) => g.supplierId)).toEqual(["s1", "s2", null]);
    expect(groups[0].items.map((i) => i.product_id)).toEqual(["p1", "p4"]);
    expect(groups[0].items[0]).toMatchObject({ quantity: 3, unit_price: 50, discount: 0 });
    expect(groups[2].items[0]).toMatchObject({ product_id: "p3", unit_price: 0 });
  });

  it("ignora quantidade zero e arredonda frações para cima", () => {
    const groups = groupRestockBySupplier(
      [
        { productId: "p1", name: "Bolsa", quantity: 0 },
        { productId: "p2", name: "Carteira", quantity: 1.2 },
      ],
      products,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].items[0].quantity).toBe(2);
  });

  it("produto que não veio do banco entra sem fornecedor, com o nome da sugestão", () => {
    const groups = groupRestockBySupplier([{ productId: "px", name: "Novo", quantity: 1 }], products);
    expect(groups[0]).toMatchObject({ supplierId: null });
    expect(groups[0].items[0].description).toBe("Novo");
  });
});
