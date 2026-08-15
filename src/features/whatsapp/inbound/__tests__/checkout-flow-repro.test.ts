import { describe, it, expect, vi } from "vitest";
import { advanceCheckout, createCheckoutSession } from "../checkout-session";
import type { CartSession } from "../cart-session";

describe("advanceCheckout - Fluxo Reestruturado", () => {
  const mockCart: CartSession = {
    companyId: "comp-1",
    phone: "5511999999999",
    items: [
      { productId: "p1", name: "Produto A", qty: 1, unitPrice: 10, subtotal: 10 }
    ],
    total: 10,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it("Teste 1: Pedido com Entrega em Tupã deve seguir a ordem correta", async () => {
    let session = createCheckoutSession("comp-1", "5511999999999");
    session.step = "WAITING_PAYMENT_METHOD";
    session.fulfillment = "delivery";
    session.deliveryFee = 5.0;
    session.totalWithFreight = 15.0;

    // Etapa 2: Forma de Pagamento
    const res1 = await advanceCheckout({
      session,
      cart: mockCart,
      text: "Pix"
    });
    expect(res1.session.payment).toBe("pix");
    expect(res1.session.step).toBe("WAITING_CUSTOMER_NAME");
    expect(res1.text).toContain("nome completo");

    // Etapa 3: Nome
    const res2 = await advanceCheckout({
      session: res1.session,
      cart: mockCart,
      text: "João Silva"
    });
    expect(res2.session.buyerName).toBe("João Silva");
    expect(res2.session.step).toBe("WAITING_ADDRESS");
    expect(res2.text).toContain("informe seu endereço completo");

    // Etapa 4: CEP
    const mockResolveCep = vi.fn().mockResolvedValue({
      street: "Rua das Flores",
      neighborhood: "Centro",
      city: "Tupã",
      state: "SP"
    });

    const res3 = await advanceCheckout({
      session: res2.session,
      cart: mockCart,
      text: "17600-000",
      resolveCep: mockResolveCep
    });
    expect(res3.session.customer.zipCode).toBe("17600000");
    expect(res3.session.step).toBe("WAITING_CONFIRMATION");
    expect(res3.text).toContain("Seu pedido ficou assim");
    // Usamos regex ou substring que ignore espaços não-quebráveis (U+00A0)
    expect(res3.text).toMatch(/Frete:\s*R\$\s*5,00/);
    expect(res3.text).toMatch(/Total:\s*R\$\s*15,00/);

    // Etapa 7: Confirmação Final
    const res6 = await advanceCheckout({
      session: res3.session,
      cart: mockCart,
      text: "Sim"
    });
    expect(res6.session.step).toBe("done");
    expect(res6.text).toContain("confirmado");
    expect(res6.session.step).toBe("done");
    expect(res6.text).toContain("confirmado");
  });

  it("Teste 4: Deve pular nome se já fornecido", async () => {
    let session = createCheckoutSession("comp-1", "5511999999999");
    session.step = "WAITING_PAYMENT_METHOD";
    session.buyerName = "Maria Oliveira";
    session.customer.fullName = "Maria Oliveira";

    const res1 = await advanceCheckout({
      session,
      cart: mockCart,
      text: "Cartão"
    });
    
    // Deve pular o step buyer_name e ir direto para o próximo
    expect(res1.session.payment).toBe("card");
    expect(res1.session.buyerName).toBe("Maria Oliveira");
    expect(res1.session.step).toBe("WAITING_ADDRESS");
  });
});
