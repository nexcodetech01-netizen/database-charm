import { describe, expect, it } from "vitest";
import { SaleEngine } from "../../engine";
import { DEFAULT_DISCOUNT_POLICY } from "../../lib/discounts";
import { createSaleDraftState, saleReducer } from "../../store/sale-store";
import { countCartUnits, findCartItemByProduct, toCartItem } from "../lib/cart";
import type { PDVProductOption } from "../types";

const PRODUCT: PDVProductOption = {
  id: "p1",
  name: "Camiseta Preta",
  sku: "PROD-0001",
  price: 100,
  cost: 40,
  stock: 5,
  unit: "UN",
};

describe("PDV — carrinho sobre o SaleStore", () => {
  it("mapeia produto para o draft canônico de item", () => {
    const item = toCartItem(PRODUCT, 2);
    expect(item.product_id).toBe("p1");
    expect(item.description).toBe("Camiseta Preta");
    expect(item.quantity).toBe(2);
    expect(item.unit_price).toBe(100);
    expect(item.discount).toBe(0);
    expect(item.stock_available).toBe(5);
    expect(item.ui_key).toBeTruthy();
  });

  it("adiciona, atualiza quantidade e remove item pelo reducer existente", () => {
    const item = toCartItem(PRODUCT);
    let state = saleReducer(createSaleDraftState(), {
      type: "ADD_ITEM",
      item,
    });
    expect(state.items).toHaveLength(1);

    state = saleReducer(state, {
      type: "UPDATE_ITEM",
      uiKey: item.ui_key!,
      patch: { quantity: 3 },
    });
    expect(state.items[0].quantity).toBe(3);
    expect(countCartUnits(state.items)).toBe(3);

    state = saleReducer(state, { type: "REMOVE_ITEM", uiKey: item.ui_key! });
    expect(state.items).toHaveLength(0);
  });

  it("encontra item já presente para o mesmo produto", () => {
    const item = toCartItem(PRODUCT);
    expect(findCartItemByProduct([item], "p1")).toBe(item);
    expect(findCartItemByProduct([item], "p2")).toBeUndefined();
  });
});

describe("PDV — totais vêm do SaleEngine", () => {
  it("calcula subtotal e total com desconto de cabeçalho", () => {
    const state = {
      ...createSaleDraftState({ discount: 30 }),
      items: [toCartItem(PRODUCT, 2)],
    };
    const totals = SaleEngine.computeTotals(state);
    expect(totals.items_total).toBe(200);
    expect(totals.grand_total).toBe(170);
  });

  it("carrinho vazio zera os totais", () => {
    const totals = SaleEngine.computeTotals(createSaleDraftState());
    expect(totals.items_total).toBe(0);
    expect(totals.grand_total).toBe(0);
  });

  it("sinaliza estoque insuficiente pelo SaleEngine", () => {
    const issues = SaleEngine.evaluateStock([toCartItem(PRODUCT, 9)]);
    expect(issues).toHaveLength(1);

    const ok = SaleEngine.evaluateStock([toCartItem(PRODUCT, 2)]);
    expect(ok).toHaveLength(0);
  });

  it("avalia desconto pela política vigente sem recalcular na UI", () => {
    const state = {
      ...createSaleDraftState({ discount: 0, paymentMethod: "pix_manual" }),
      items: [toCartItem(PRODUCT, 1)],
    };
    const evaluation = SaleEngine.evaluateDiscount({
      state,
      policy: DEFAULT_DISCOUNT_POLICY,
      overrideApproved: false,
    });
    expect(["no_discount", "disabled_by_policy"]).toContain(evaluation.kind);
  });
});
