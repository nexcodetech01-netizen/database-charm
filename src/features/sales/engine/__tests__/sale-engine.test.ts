import { describe, it, expect } from "vitest";
import {
  SaleEngine,
  buildSalePayload,
  resolveSaleStatus,
  validateSaleItems,
} from "../sale-engine";
import { createSaleDraftState, saleReducer } from "../../store/sale-store";
import { DEFAULT_DISCOUNT_POLICY } from "../../lib/discounts";
import type { SaleItemDraft } from "../../types";

function item(over: Partial<SaleItemDraft> = {}): SaleItemDraft {
  return {
    ui_key: over.ui_key ?? "k1",
    product_id: "p1",
    description: "Produto",
    quantity: 2,
    unit_price: 50,
    discount: 0,
    ...over,
  } as SaleItemDraft;
}

describe("SaleEngine · totais", () => {
  it("replica computeTotals do formulário", () => {
    const state = createSaleDraftState({
      items: [item(), item({ ui_key: "k2", quantity: 1, unit_price: 30 })],
      discount: 10,
      shipping: 5,
    });
    const t = SaleEngine.computeTotals(state);
    expect(t.items_total).toBe(130);
    expect(t.grand_total).toBe(125);
  });

  it("nunca devolve total negativo", () => {
    const state = createSaleDraftState({ items: [item({ unit_price: 1, quantity: 1 })], discount: 999 });
    expect(SaleEngine.computeTotals(state).grand_total).toBe(0);
  });

  it("considera acréscimo e desconto por item", () => {
    const state = createSaleDraftState({
      items: [
        item({ ui_key: "k1", unit_price: 100, quantity: 1, discount: 10 }), // 90
        item({ ui_key: "k2", unit_price: 100, quantity: 1, addition: 20 }), // 120
      ],
      discount: 0,
      shipping: 0,
    });
    const t = SaleEngine.computeTotals(state);
    expect(t.items_total).toBe(210);
  });
});

describe("SaleEngine · validações", () => {
  it("exige número", () => {
    expect(SaleEngine.validateIdentity(createSaleDraftState()).ok).toBe(false);
    expect(SaleEngine.validateIdentity(createSaleDraftState({ number: "VD-1" })).ok).toBe(true);
  });

  it("exige cliente", () => {
    expect(SaleEngine.validateCustomer(createSaleDraftState()).ok).toBe(false);
    expect(SaleEngine.validateCustomer(createSaleDraftState({ customerId: "c1" })).ok).toBe(true);
  });

  it("bloqueia carrinho vazio e item inválido", () => {
    expect(validateSaleItems([])).toMatchObject({ ok: false, code: "no_items" });
    expect(validateSaleItems([item({ quantity: 0 })])).toMatchObject({
      ok: false,
      code: "invalid_item",
    });
    expect(validateSaleItems([item({ description: "  " })])).toMatchObject({
      ok: false,
      code: "invalid_item",
    });
    expect(validateSaleItems([item()])).toEqual({ ok: true });
  });
});

describe("SaleEngine · estoque", () => {
  it("acusa insuficiência com estoque fresco do banco", () => {
    const items = [item({ quantity: 5, stock_available: 10 } as Partial<SaleItemDraft>)];
    expect(SaleEngine.evaluateStock(items)).toHaveLength(0);
    const fresh = new Map<string, number | null>([["p1", 2]]);
    expect(SaleEngine.evaluateStock(items, fresh)).toHaveLength(1);
  });
});

describe("SaleEngine · desconto", () => {
  it("delega à política vigente", () => {
    const state = createSaleDraftState({
      items: [item()],
      discount: 90,
      paymentMethod: "cash",
    });
    const res = SaleEngine.evaluateDiscount({
      state,
      policy: { ...DEFAULT_DISCOUNT_POLICY, maxPercent: 5, enforcement: "block" },
      overrideApproved: false,
    });
    expect(res.kind).toBe("exceeds");
  });
});

describe("SaleEngine · status e payload", () => {
  const base = createSaleDraftState({
    number: " VD-1 ",
    customerId: "c1",
    paymentMethod: "pix_manual",
    discount: 10,
    shipping: 4,
    notes: "  obs  ",
    items: [item()],
  });

  it("sem finalizar mantém o status do formulário", () => {
    expect(
      resolveSaleStatus({ ...base, status: "draft" }, { finalize: false, isEdit: false }),
    ).toBe("draft");
  });

  it("finalização normal grava pending", () => {
    expect(resolveSaleStatus(base, { finalize: true, isEdit: false })).toBe("pending");
  });

  it("A Receber grava draft e exige promoção", () => {
    const s = { ...base, paymentMethod: "a_receber" };
    expect(resolveSaleStatus(s, { finalize: true, isEdit: false })).toBe("draft");
    expect(SaleEngine.needsReceivablePromotion(s, true)).toBe(true);
    expect(SaleEngine.requiresCheckout(s.paymentMethod, true)).toBe(false);
  });

  it("edição de venda paga preserva paid", () => {
    expect(
      resolveSaleStatus(base, { finalize: true, isEdit: true, persistedStatus: "paid" }),
    ).toBe("paid");
  });

  it("payload normaliza trim, nulos e nunca envia sale_date", () => {
    const p = buildSalePayload(base, {
      companyId: "co1",
      finalize: true,
      isEdit: false,
      cashSessionId: "cs1",
    });
    expect(p).toEqual({
      company_id: "co1",
      number: "VD-1",
      customer_id: "c1",
      sale_date: "",
      payment_method: "pix_manual",
      status: "pending",
      discount: 10,
      shipping: 4,
      notes: "obs",
      cash_session_id: "cs1",
    });
  });

  it("notes vazio vira null", () => {
    const p = buildSalePayload(
      { ...base, notes: "   " },
      { companyId: "co1", finalize: false, isEdit: false, cashSessionId: null },
    );
    expect(p.notes).toBeNull();
  });
});

describe("SaleStore · reducer", () => {
  it("aplica transições sem mutar o estado anterior", () => {
    const s0 = createSaleDraftState();
    const s1 = saleReducer(s0, { type: "ADD_ITEM", item: item() });
    expect(s0.items).toHaveLength(0);
    expect(s1.items).toHaveLength(1);

    const s2 = saleReducer(s1, { type: "UPDATE_ITEM", uiKey: "k1", patch: { quantity: 7 } });
    expect(s2.items[0].quantity).toBe(7);

    const s3 = saleReducer(s2, { type: "REMOVE_ITEM", uiKey: "k1" });
    expect(s3.items).toHaveLength(0);

    const s4 = saleReducer(s3, { type: "SET_DISCOUNT", value: Number("abc") });
    expect(s4.discount).toBe(0);

    expect(saleReducer(s4, { type: "RESET" })).toEqual(createSaleDraftState());
  });

  it("aplica alteração de preço, desconto e acréscimo por item", () => {
    const s0 = createSaleDraftState({ items: [item({ unit_price: 100 })] });
    
    // Preço
    const s1 = saleReducer(s0, { type: "UPDATE_ITEM_PRICE", uiKey: "k1", price: 120 });
    expect(s1.items[0].unit_price).toBe(120);
    expect(s1.items[0].original_unit_price).toBe(100);

    // Desconto
    const s2 = saleReducer(s1, { type: "UPDATE_ITEM_DISCOUNT", uiKey: "k1", discount: 10 });
    expect(s2.items[0].discount).toBe(10);

    // Acréscimo
    const s3 = saleReducer(s2, { type: "UPDATE_ITEM_ADDITION", uiKey: "k1", addition: 5 });
    expect(s3.items[0].addition).toBe(5);
  });
});
