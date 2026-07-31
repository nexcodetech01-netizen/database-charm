import { describe, expect, it } from "vitest";
import {
  PDV_CHECKOUT_METHODS,
  isCashSufficient,
  pdvChange,
  resolveCheckoutClose,
  toFinancePaymentMethod,
} from "../lib/payments";
import { PDV_SESSION_INITIAL, pdvSessionReducer } from "../lib/completion";

const sale = { id: "s1", number: "PDV-1", total: 100 };

describe("PDV — motor de pagamentos (Sprint 2.6)", () => {
  it("habilita todas as formas do checkout existente", () => {
    expect(PDV_CHECKOUT_METHODS).toEqual([
      "cash",
      "pix",
      "pix_manual",
      "credit_card",
      "debit_card",
      "credit",
      "payment_link",
      "boleto",
    ]);
  });

  it("traduz dinheiro, PIX, cartão e crediário", () => {
    expect(toFinancePaymentMethod("cash")).toBe("cash");
    expect(toFinancePaymentMethod("pix")).toBe("bella_pay");
    expect(toFinancePaymentMethod("pix_manual")).toBe("pix");
    expect(toFinancePaymentMethod("credit_card")).toBe("credit_card");
    expect(toFinancePaymentMethod("debit_card")).toBe("debit_card");
    expect(toFinancePaymentMethod("boleto")).toBe("boleto");
    expect(toFinancePaymentMethod("credit")).toBe("other");
    expect(toFinancePaymentMethod(undefined)).toBe("other");
  });

  it("calcula o troco em tempo real", () => {
    expect(pdvChange(100, 150)).toBe(50);
    expect(pdvChange(100, 100)).toBe(0);
    expect(pdvChange(100, 80)).toBe(0);
    expect(pdvChange(19.9, 20)).toBe(0.1);
    expect(isCashSufficient(100, 99.99)).toBe(false);
    expect(isCashSufficient(100, 100)).toBe(true);
  });

  it("abre o checkout ao criar a venda", () => {
    const s = pdvSessionReducer(PDV_SESSION_INITIAL, {
      type: "SALE_CREATED",
      sale,
    });
    expect(s.checkoutOpen).toBe(true);
    expect(s.pendingSale).toEqual(sale);
  });

  it("conclui a venda quando o pagamento é confirmado", () => {
    let s = pdvSessionReducer(PDV_SESSION_INITIAL, {
      type: "SALE_CREATED",
      sale,
    });
    s = pdvSessionReducer(s, { type: "SALE_RECEIVED", paymentMethod: "cash" });
    expect(s.pendingSale).toBeNull();
    expect(s.completed?.paymentMethod).toBe("cash");
    expect(resolveCheckoutClose({ paid: true })).toBe("completed");
  });

  it("erro/cancelamento no pagamento faz rollback para o carrinho", () => {
    let s = pdvSessionReducer(PDV_SESSION_INITIAL, {
      type: "SALE_CREATED",
      sale,
    });
    s = pdvSessionReducer(s, { type: "CLOSE_CHECKOUT" });
    expect(s.checkoutOpen).toBe(false);
    expect(s.pendingSale).toBeNull();
    expect(s.completed).toBeNull();
    expect(resolveCheckoutClose({ paid: false })).toBe("back-to-cart");
  });

  it("nova venda limpa o carrinho e a sessão", () => {
    let s = pdvSessionReducer(PDV_SESSION_INITIAL, {
      type: "SALE_CREATED",
      sale,
    });
    s = pdvSessionReducer(s, { type: "SALE_RECEIVED", paymentMethod: "pix" });
    s = pdvSessionReducer(s, { type: "NEW_SALE" });
    expect(s).toEqual(PDV_SESSION_INITIAL);
  });
});
