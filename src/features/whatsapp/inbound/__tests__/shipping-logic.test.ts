import { describe, it, expect, vi, beforeEach } from "vitest";
import { advanceCheckout, createCheckoutSession, type CheckoutSession, formatWebsiteOrderSummary } from "../checkout-session";
import type { CartSession } from "../cart-session";

describe("Frete e Total - Outra Cidade", () => {
  const companyId = "test-company";
  const phone = "5511999999999";
  
  const mockCart: CartSession = {
    companyId,
    phone,
    items: [
      { productId: "p1", name: "Blusa", qty: 1, unitPrice: 48, subtotal: 48 }
    ],
    total: 48,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const createSession = (step: any = "WAITING_ADDRESS"): CheckoutSession => {
    const s = createCheckoutSession(companyId, phone);
    s.step = step;
    s.deliveryFee = null; // Inicia pendente
    return s;
  };

  it("A) Entrega em Tupã com frete R$ 5,00 → PASS", async () => {
    const session = createSession();
    session.deliveryFee = 5;
    session.customer.fullName = "João";
    
    const summary = formatWebsiteOrderSummary(session, mockCart);
    
    expect(summary).toContain("Subtotal: R$ 48,00");
    expect(summary).toContain("Frete: R$ 5,00");
    expect(summary).toContain("Total: R$ 53,00");
    expect(summary).not.toContain("Será calculado para envio");
  });

  it("B) Outra cidade com frete ainda não calculado → não mostrar R$ 0,00", async () => {
    const session = createSession();
    session.deliveryFee = null;
    
    const summary = formatWebsiteOrderSummary(session, mockCart);
    
    expect(summary).toContain("Frete: Será calculado para envio");
    expect(summary).not.toContain("Frete: R$ 0,00");
    expect(summary).toContain("📦 A taxa de envio para sua cidade será calculada");
  });

  it("C) Outra cidade com frete calculado → mostrar o valor correto", async () => {
    const session = createSession();
    session.deliveryFee = 25.50; // Calculado depois
    
    const summary = formatWebsiteOrderSummary(session, mockCart);
    
    expect(summary).toContain("Frete: R$ 25,50");
    expect(summary).toContain("Total: R$ 73,50");
    expect(summary).not.toContain("Será calculado para envio");
  });

  it("D) Total antes do frete → não apresentar como total final (A calcular)", async () => {
    const session = createSession();
    session.deliveryFee = null;
    
    const summary = formatWebsiteOrderSummary(session, mockCart);
    
    expect(summary).toContain("Total: A calcular");
    expect(summary).not.toContain("Total: R$ 48,00");
  });

  it("E) Total depois do frete → subtotal + frete corretamente", async () => {
    const session = createSession();
    session.deliveryFee = 10;
    
    const summary = formatWebsiteOrderSummary(session, mockCart);
    
    expect(summary).toContain("Subtotal: R$ 48,00");
    expect(summary).toContain("Frete: R$ 10,00");
    expect(summary).toContain("Total: R$ 58,00");
  });

  it("F) Bloqueio de confirmação se frete for null", async () => {
    const session = createSession("WAITING_CONFIRMATION");
    session.deliveryFee = null;
    
    const result = await advanceCheckout({
      session,
      cart: mockCart,
      text: "sim",
      resolveCep: vi.fn()
    });
    
    expect(result.session.step).toBe("WAITING_CONFIRMATION");
    expect(result.text).toContain("Aguarde um momentinho");
  });
});
