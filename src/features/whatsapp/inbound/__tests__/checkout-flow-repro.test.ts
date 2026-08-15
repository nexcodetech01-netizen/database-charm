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
    session.step = "payment";
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
    expect(res1.session.step).toBe("buyer_name");
    expect(res1.text).toContain("nome completo");

    // Etapa 3: Nome
    const res2 = await advanceCheckout({
      session: res1.session,
      cart: mockCart,
      text: "João Silva"
    });
    expect(res2.session.buyerName).toBe("João Silva");
    expect(res2.session.step).toBe("zip_code");
    expect(res2.text).toContain("Agora preciso do endereço");

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
    expect(res3.session.step).toBe("address_number");
    expect(res3.text).toContain("Qual é o número");

    // Etapa 4.1: Número
    const res4 = await advanceCheckout({
      session: res3.session,
      cart: mockCart,
      text: "123"
    });
    expect(res4.session.customer.number).toBe("123");
    expect(res4.session.step).toBe("address_complement");

    // Etapa 4.2: Complemento
    const res5 = await advanceCheckout({
      session: res4.session,
      cart: mockCart,
      text: "Casa"
    });
    expect(res5.session.step).toBe("summary");
    expect(res5.text).toContain("Seu pedido ficou assim");
    expect(res5.text).toContain("Frete: R$ 5,00");
    expect(res5.text).toContain("Total: R$ 15,00");

    // Etapa 7: Confirmação Final
    const res6 = await advanceCheckout({
      session: res5.session,
      cart: mockCart,
      text: "Sim"
    });
    expect(res6.session.step).toBe("done");
    expect(res6.text).toContain("confirmado");
  });

  it("Teste 4: Deve pular nome se já fornecido", async () => {
    let session = createCheckoutSession("comp-1", "5511999999999");
    session.step = "payment";
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
    expect(res1.session.step).toBe("zip_code");
  });
});
