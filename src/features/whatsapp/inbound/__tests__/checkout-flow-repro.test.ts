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
      text: "Cartão",
      resolveCep: vi.fn().mockResolvedValue({
        street: "Rua das Flores",
        neighborhood: "Centro",
        city: "Tupã",
        state: "SP"
      })
    });
    
    // Deve pular o step buyer_name e ir para o endereço. 
    // Como a recursão usa o nome como input do endereço, e o nome não é um endereço/CEP válido,
    // ele deve parar no step WAITING_ADDRESS.
    expect(res1.session.payment).toBe("card");
    expect(res1.session.buyerName).toBe("Maria Oliveira");
    expect(res1.session.step).toBe("WAITING_ADDRESS");
  });

  it("BUG REPORT: Deve aceitar 'dinheiro' e avançar para o nome", async () => {
    let session = createCheckoutSession("comp-1", "5511999999999");
    session.step = "WAITING_PAYMENT_METHOD";
    session.fulfillment = "delivery";

    const res1 = await advanceCheckout({
      session,
      cart: mockCart,
      text: "dinheiro"
    });
    
    expect(res1.session.payment).toBe("cash");
    expect(res1.session.step).toBe("WAITING_CUSTOMER_NAME");
    expect(res1.text).toContain("Qual é o seu nome completo?");
    
    const res2 = await advanceCheckout({
      session: res1.session,
      cart: mockCart,
      text: "Tiele Thais M Andriani"
    });
    
    expect(res2.session.customer.fullName).toBe("Tiele Thais M Andriani");
    expect(res2.session.step).toBe("WAITING_ADDRESS");
    expect(res2.text).toContain("informe seu endereço completo com CEP");
  });

  it("Normalização: Deve aceitar variações de formas de pagamento", async () => {
    const cases = [
      { input: "em dinheiro", expected: "cash" },
      { input: "espécie", expected: "cash" },
      { input: "especie", expected: "cash" },
      { input: "pix", expected: "pix" },
      { input: "PIX", expected: "pix" },
      { input: "cartão", expected: "card" },
      { input: "cartao", expected: "card" },
      { input: "débito", expected: "card" },
      { input: "cartão de crédito", expected: "card" },
      { input: "cartao de credito", expected: "card" },
    ];

    for (const c of cases) {
      let session = createCheckoutSession("comp-1", "5511999999999");
      session.step = "WAITING_PAYMENT_METHOD";
      
      const res = await advanceCheckout({
        session,
        cart: mockCart,
        text: c.input
      });
      
      expect(res.session.payment, `Failed for input: ${c.input}`).toBe(c.expected);
    }
  });

  it("Resposta para pagamento não reconhecido", async () => {
    let session = createCheckoutSession("comp-1", "5511999999999");
    session.step = "WAITING_PAYMENT_METHOD";

    const res = await advanceCheckout({
      session,
      cart: mockCart,
      text: "quero pagar com abraço"
    });
    
    expect(res.session.payment).toBeNull();
    expect(res.session.step).toBe("WAITING_PAYMENT_METHOD");
    expect(res.text).toContain("Não consegui identificar a forma de pagamento");
  });
});
