import { describe, expect, it } from "vitest";
import { computeItemTotal } from "../../types";
import { createSaleDraftState, saleReducer } from "../sale-store";

describe("UPDATE_ITEM_PRICE", () => {
  it("zera desconto e acréscimo: o novo preço vira o valor do item", () => {
    const base = createSaleDraftState();
    const item = { ui_key: "a", product_id: "p", quantity: 1, unit_price: 63, discount: 63, addition: 0 };
    const withItem = saleReducer(base, { type: "ADD_ITEM", item: item as never });
    const next = saleReducer(withItem, { type: "UPDATE_ITEM_PRICE", uiKey: "a", price: 50 });
    const it0 = next.items[0];
    expect(it0.unit_price).toBe(50);
    expect(it0.discount).toBe(0);
    expect(computeItemTotal(it0)).toBe(50);
  });
});
