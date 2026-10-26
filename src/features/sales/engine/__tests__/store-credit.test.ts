import { describe, expect, it } from "vitest";
import { SaleEngine } from "../index";
import { createSaleDraftState, saleReducer } from "../../store/sale-store";
import type { SaleItemDraft } from "../../types";

const item = {
  product_id: "p1",
  description: "Camiseta",
  quantity: 1,
  unit_price: 100,
  discount: 0,
  ui_key: "a",
} as unknown as SaleItemDraft;

describe("vale-troca na venda", () => {
  it("abate do total e vai no payload como parte do desconto", () => {
    const state = createSaleDraftState({
      number: "PDV-1",
      items: [item],
      discount: 5,
      storeCredit: 40,
    });
    expect(SaleEngine.computeTotals(state).grand_total).toBe(55);
    const payload = SaleEngine.buildPayload(state, {
      companyId: "c",
      finalize: true,
      isEdit: false,
      cashSessionId: null,
    });
    expect(payload.discount).toBe(45);
    expect(payload.store_credit_used).toBe(40);
  });

  it("sem vale não envia store_credit_used", () => {
    const state = createSaleDraftState({ number: "PDV-1", items: [item] });
    const payload = SaleEngine.buildPayload(state, {
      companyId: "c",
      finalize: true,
      isEdit: false,
      cashSessionId: null,
    });
    expect("store_credit_used" in payload).toBe(false);
  });

  it("trocar a cliente zera o vale em uso", () => {
    let state = createSaleDraftState({ customerId: "ana", storeCredit: 30 });
    state = saleReducer(state, { type: "SET_CUSTOMER", value: "ana" });
    expect(state.storeCredit).toBe(30);
    state = saleReducer(state, { type: "SET_CUSTOMER", value: "bia" });
    expect(state.storeCredit).toBe(0);
  });
});
