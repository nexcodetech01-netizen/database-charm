import { describe, it, expect, vi } from 'vitest';
import { advanceCheckout, createCheckoutSession, type CheckoutSession, type CheckoutAdvanceResult } from './checkout-session';
import type { CartSession } from './cart-session';

const mockCompanyId = "test-company";
const mockPhone = "5511999999999";

const mockCart: CartSession = {
  companyId: mockCompanyId,
  phone: mockPhone,
  items: [
    { productId: "p1", name: "Produto Teste", qty: 1, unitPrice: 40, subtotal: 40 }
  ],
  total: 40,
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const mockCepResolver = async (cep: string) => ({
  street: "Rua Teste",
  neighborhood: "Bairro Teste",
  city: "Cidade Teste",
  state: "SP"
});

describe('Checkout Shipping Waiting Flow', () => {
  it('A) Should transition to WAITING_SHIPPING_FEE when deliveryFee is null after address', async () => {
    const session = createCheckoutSession(mockCompanyId, mockPhone);
    session.step = "WAITING_ADDRESS";
    session.deliveryFee = null;
    session.customer.fullName = "João Silva";
    session.customer.cpf = "12345678901";

    const result = await advanceCheckout({
      session,
      cart: mockCart,
      text: "Rua Teste, 123, 01001-000",
      resolveCep: mockCepResolver
    });

    expect(result.session.step).toBe("WAITING_SHIPPING_FEE");
    expect(result.text).toContain("calculando o frete");
  });

  it('B, C, D, E) Should parse currency correctly in WAITING_SHIPPING_FEE and update total', async () => {
    const baseSession = createCheckoutSession(mockCompanyId, mockPhone);
    baseSession.step = "WAITING_SHIPPING_FEE";
    baseSession.deliveryFee = null;
    baseSession.customer.fullName = "João Silva";
    baseSession.customer.cpf = "12345678901";
    baseSession.customer.street = "Rua Teste";

    const testCases = [
      { input: "18,00 reais", expected: 18 },
      { input: "R$ 18,00", expected: 18 },
      { input: "18", expected: 18 }
    ];

    for (const tc of testCases) {
      const result = await advanceCheckout({
        session: { ...baseSession },
        cart: mockCart,
        text: tc.input
      });

      expect(result.session.deliveryFee).toBe(tc.expected);
      expect(result.session.step).toBe("WAITING_CONFIRMATION");
      expect(result.text).toContain("Subtotal: R$ 40,00");
      expect(result.text).toContain("Frete: R$ 18,00");
      expect(result.text).toContain("Total: R$ 58,00");
    }
  });

  it('F, G) Should reject invalid or zero shipping fee', async () => {
    const session = createCheckoutSession(mockCompanyId, mockPhone);
    session.step = "WAITING_SHIPPING_FEE";
    session.deliveryFee = null;

    const invalidInputs = ["grátis", "0", "-5", "abc"];

    for (const input of invalidInputs) {
      const result = await advanceCheckout({
        session: { ...session },
        cart: mockCart,
        text: input
      });

      expect(result.session.step).toBe("WAITING_SHIPPING_FEE");
      expect(result.session.deliveryFee).toBeNull();
    }
  });

  it('H) Should NOT enter WAITING_SHIPPING_FEE if deliveryFee is already set', async () => {
    const session = createCheckoutSession(mockCompanyId, mockPhone);
    session.step = "WAITING_ADDRESS";
    session.deliveryFee = 5;

    const result = await advanceCheckout({
      session,
      cart: mockCart,
      text: "Rua Teste, 123, 01001-000",
      resolveCep: mockCepResolver
    });

    expect(result.session.step).toBe("WAITING_CONFIRMATION");
    expect(result.session.deliveryFee).toBe(5);
  });

  it('I, J) Should keep WAITING_CHANGE_INFO working normally', async () => {
    const session = createCheckoutSession(mockCompanyId, mockPhone);
    session.step = "WAITING_PAYMENT_METHOD";
    
    // Choose Cash
    const result1 = await advanceCheckout({
      session,
      cart: mockCart,
      text: "Dinheiro"
    });
    expect(result1.session.step).toBe("WAITING_CHANGE_INFO");

    // Troco de 50 para pedido de 40
    const result2 = await advanceCheckout({
      session: result1.session,
      cart: mockCart,
      text: "50"
    });
    expect(result2.session.changeAmount).toBe(50);
    expect(result2.session.step).toBe("WAITING_CUSTOMER_NAME");
  });

  it('K) Should NOT save shipping fee as changeAmount', async () => {
    const session = createCheckoutSession(mockCompanyId, mockPhone);
    session.step = "WAITING_SHIPPING_FEE";
    session.deliveryFee = null;
    session.changeAmount = null;

    const result = await advanceCheckout({
      session,
      cart: mockCart,
      text: "18,00 reais"
    });

    expect(result.session.deliveryFee).toBe(18);
    expect(result.session.changeAmount).toBeNull();
  });

  it('L) Should block confirmation if deliveryFee is null', async () => {
    const session = createCheckoutSession(mockCompanyId, mockPhone);
    session.step = "WAITING_CONFIRMATION";
    session.deliveryFee = null;

    const result = await advanceCheckout({
      session,
      cart: mockCart,
      text: "Sim"
    });

    expect(result.session.step).toBe("WAITING_CONFIRMATION");
    expect(result.text).toContain("Aguarde um momentinho");
  });
});
