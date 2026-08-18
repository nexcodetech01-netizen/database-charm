import { describe, it, expect, vi } from "vitest";
import { advanceCheckout, createCheckoutSession, type CheckoutSession, formatWebsiteOrderSummary } from "../checkout-session";
import type { CartSession } from "../cart-session";

describe("WAITING_SHIPPING_FEE Flow Logic", () => {
  const companyId = "test-company";
  const phone = "5511999999999";
  
  const mockCart: CartSession = {
    companyId,
    phone,
    items: [
      { productId: "p1", name: "Produto Teste", qty: 1, unitPrice: 40, subtotal: 40 }
    ],
    total: 40,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const createBaseSession = () => {
    const s = createCheckoutSession(companyId, phone);
    s.customer.fullName = "João da Silva";
    s.customer.cpf = "12345678909";
    return s;
  };

  it("A) deliveryFee = null na transição do endereço → deve ir para WAITING_SHIPPING_FEE", async () => {
    const session = createBaseSession();
    session.step = "WAITING_ADDRESS";
    session.deliveryFee = null;

    const result = await advanceCheckout({
      session,
      cart: mockCart,
      text: "Rua Teste, 123, 01001-000",
      resolveCep: async (cep) => ({
        street: "Rua Teste",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP"
      })
    });

    expect(result.session.step).toBe("WAITING_SHIPPING_FEE");
    expect(result.session.deliveryFee).toBeNull();
    expect(result.text).toContain("calculando o frete");
  });

  it("B) '18,00 reais' no estado WAITING_SHIPPING_FEE → deliveryFee = 18", async () => {
    const session = createBaseSession();
    session.step = "WAITING_SHIPPING_FEE";
    session.deliveryFee = null;

    const result = await advanceCheckout({
      session,
      cart: mockCart,
      text: "18,00 reais"
    });

    expect(result.session.deliveryFee).toBe(18);
    expect(result.session.step).toBe("WAITING_CONFIRMATION");
  });

  it("C) R$ 40 (subtotal) + R$ 18 (frete) → Total R$ 58 no resumo", async () => {
    const session = createBaseSession();
    session.step = "WAITING_SHIPPING_FEE";
    session.deliveryFee = null;

    const result = await advanceCheckout({
      session,
      cart: mockCart,
      text: "18"
    });

    expect(result.text).toContain("Subtotal: R$ 40,00");
    expect(result.text).toContain("Frete: R$ 18,00");
    expect(result.text).toContain("Total: R$ 58,00");
    expect(result.text).toContain("Está tudo certinho?");
  });

  it("D) 'R$ 18,00' → parse para 18", async () => {
    const session = createBaseSession();
    session.step = "WAITING_SHIPPING_FEE";
    const result = await advanceCheckout({ session, cart: mockCart, text: "R$ 18,00" });
    expect(result.session.deliveryFee).toBe(18);
  });

  it("E) '18' → parse para 18", async () => {
    const session = createBaseSession();
    session.step = "WAITING_SHIPPING_FEE";
    const result = await advanceCheckout({ session, cart: mockCart, text: "18" });
    expect(result.session.deliveryFee).toBe(18);
  });

  it("F) 'abc' (inválido) → permanece WAITING_SHIPPING_FEE", async () => {
    const session = createBaseSession();
    session.step = "WAITING_SHIPPING_FEE";
    const result = await advanceCheckout({ session, cart: mockCart, text: "abc" });
    expect(result.session.step).toBe("WAITING_SHIPPING_FEE");
    expect(result.text).toContain("Não entendi o valor do frete");
  });

  it("G) '0' (inválido) → permanece WAITING_SHIPPING_FEE", async () => {
    const session = createBaseSession();
    session.step = "WAITING_SHIPPING_FEE";
    const result = await advanceCheckout({ session, cart: mockCart, text: "0" });
    expect(result.session.step).toBe("WAITING_SHIPPING_FEE");
    expect(result.text).toContain("Não entendi o valor do frete");
  });

  it("H) Pedido com frete já calculado → NÃO entra em WAITING_SHIPPING_FEE", async () => {
    const session = createBaseSession();
    session.step = "WAITING_ADDRESS";
    session.deliveryFee = 5;

    const result = await advanceCheckout({
      session,
      cart: mockCart,
      text: "Rua Teste, 123, 01001-000",
      resolveCep: async (cep) => ({
        street: "Rua Teste",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP"
      })
    });

    expect(result.session.step).toBe("WAITING_CONFIRMATION");
    expect(result.session.deliveryFee).toBe(5);
  });

  it("I) Fluxo de Dinheiro + Troco → changeAmount ok, deliveryFee inalterado", async () => {
    const session = createBaseSession();
    session.step = "WAITING_CHANGE_INFO";
    session.deliveryFee = 18; // Já temos frete
    session.payment = "cash";

    const result = await advanceCheckout({
      session,
      cart: mockCart,
      text: "100" // Troco para 100
    });

    expect(result.session.changeAmount).toBe(100);
    expect(result.session.deliveryFee).toBe(18); // Deve manter o frete
    expect(result.session.step).toBe("WAITING_DOCUMENT"); // Seguindo fluxo linear
  });

  it("J) Confirmar pedido com deliveryFee === null → bloqueado", async () => {
    const session = createBaseSession();
    session.step = "WAITING_CONFIRMATION";
    session.deliveryFee = null;

    const result = await advanceCheckout({
      session,
      cart: mockCart,
      text: "sim"
    });

    expect(result.session.step).toBe("WAITING_CONFIRMATION");
    expect(result.text).toContain("Aguarde um momentinho");
  });

  it("K) Confirmar pedido com deliveryFee = 18 → permitido (done)", async () => {
    const session = createBaseSession();
    session.step = "WAITING_CONFIRMATION";
    session.deliveryFee = 18;

    const result = await advanceCheckout({
      session,
      cart: mockCart,
      text: "sim"
    });

    expect(result.session.step).toBe("done");
  });
});