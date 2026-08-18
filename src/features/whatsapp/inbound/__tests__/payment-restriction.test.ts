import { describe, it, expect, vi } from "vitest";
import { advanceCheckout, createCheckoutSession, type CheckoutSession } from "../checkout-session";
import type { CartSession } from "../cart-session";

describe("Restrição de Pagamento - Outra Cidade", () => {
  const companyId = "test-company";
  const phone = "5511999999999";
  
  const mockCart: CartSession = {
    companyId,
    phone,
    items: [{ productId: "p1", name: "Produto", qty: 1, unitPrice: 50, subtotal: 50 }],
    total: 50,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const createSession = (isOther: boolean): CheckoutSession => {
    const s = createCheckoutSession(companyId, phone);
    s.isOtherCity = isOther;
    s.step = isOther ? "WAITING_PAYMENT_METHOD_OTHER_CITY" : "WAITING_PAYMENT_METHOD";
    return s;
  };

  it("1. ENTREGA LOCAL: opções = PIX, Cartão, Dinheiro", async () => {
    const session = createSession(false);
    // Dinheiro deve ser aceito e levar para WAITING_CHANGE_INFO
    const result = await advanceCheckout({ session, cart: mockCart, text: "3" }); // 3 = Dinheiro
    expect(result.session.payment).toBe("cash");
    expect(result.session.step).toBe("WAITING_CHANGE_INFO");
  });

  it("2. ENVIO PARA OUTRA CIDADE: Dinheiro não deve ser aceito", async () => {
    const session = createSession(true);
    const result = await advanceCheckout({ session, cart: mockCart, text: "dinheiro" });
    expect(result.session.payment).toBeNull();
    expect(result.session.step).toBe("WAITING_PAYMENT_METHOD_OTHER_CITY");
    expect(result.text).toContain("aceitamos apenas PIX ou Cartão");
  });

  it("3. ENVIO PARA OUTRA CIDADE + PIX: não entra em WAITING_CHANGE_INFO", async () => {
    const session = createSession(true);
    const result = await advanceCheckout({ session, cart: mockCart, text: "pix" });
    expect(result.session.payment).toBe("pix");
    expect(result.session.step).not.toBe("WAITING_CHANGE_INFO");
  });

  it("4. ENVIO PARA OUTRA CIDADE + CARTÃO: não entra em WAITING_CHANGE_INFO", async () => {
    const session = createSession(true);
    const result = await advanceCheckout({ session, cart: mockCart, text: "cartão" });
    expect(result.session.payment).toBe("card");
    expect(result.session.step).not.toBe("WAITING_CHANGE_INFO");
  });

  it("5. Pedido local com troco preservado", async () => {
    const session = createSession(false);
    const r1 = await advanceCheckout({ session, cart: mockCart, text: "3" }); // Cash
    const r2 = await advanceCheckout({ session: r1.session, cart: mockCart, text: "100" }); // Troco
    expect(r2.session.changeAmount).toBe(100);
  });

  it("6. WAITING_SHIPPING_FEE deve ser preservado se deliveryFee for null", async () => {
    const session = createSession(true);
    session.deliveryFee = null;
    session.customer.fullName = "Teste";
    session.customer.cpf = "12345678909";
    
    // Simula chegar no endereço
    session.step = "WAITING_ADDRESS";
    const result = await advanceCheckout({ 
      session, 
      cart: mockCart, 
      text: "Rua Teste, 123, 17600-000",
      resolveCep: async () => ({ street: "Rua Teste", neighborhood: "Bairro", city: "Cidade", state: "SP" })
    });
    
    expect(result.session.step).toBe("WAITING_SHIPPING_FEE");
  });
});
