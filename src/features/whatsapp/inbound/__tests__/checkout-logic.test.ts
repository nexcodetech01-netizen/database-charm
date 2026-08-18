import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleCheckoutTurn, resetCheckoutSessions, saveCheckoutSession } from "../checkout-session.server";
import { createCheckoutSession } from "../checkout-session";
import { saveCartSession, resetCartSessions } from "../cart-session.server";
import type { CartSession } from "../cart-session";
import { supabaseAdminMock } from "./session-store.mock";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: supabaseAdminMock,
}));

describe("Checkout Logic Tests (A-G)", () => {
  const companyId = "test-comp";
  const phone = "5511999999999";
  
  const mockCart: CartSession = {
    companyId,
    phone,
    items: [
      { productId: "p1", name: "Produto R$40", qty: 1, unitPrice: 40, subtotal: 40 }
    ],
    total: 40,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // Com frete de R$5 conforme pedido
  const cartWithFreight = { ...mockCart, total: 45 };

  beforeEach(async () => {
    await resetCheckoutSessions();
    await resetCartSessions();
    await saveCartSession(cartWithFreight);
  });

  it("TESTE A — PIX", async () => {
    const session = createCheckoutSession(companyId, phone);
    session.step = "WAITING_PAYMENT_METHOD";
    session.customer.fullName = "Test User"; // Simula que já tem nome
    await saveCheckoutSession(session);

    const turn = await handleCheckoutTurn({ companyId, phone, text: "1" });
    expect(turn?.step).toBe("WAITING_DOCUMENT");
    expect(turn?.text).toContain("CPF");
  });

  it("TESTE B — CARTÃO", async () => {
    const session = createCheckoutSession(companyId, phone);
    session.step = "WAITING_PAYMENT_METHOD";
    session.customer.fullName = "Test User";
    await saveCheckoutSession(session);

    const turn = await handleCheckoutTurn({ companyId, phone, text: "2" });
    expect(turn?.step).toBe("WAITING_DOCUMENT");
  });

  it("TESTE C — DINHEIRO SEM TROCO", async () => {
    const session = createCheckoutSession(companyId, phone);
    session.step = "WAITING_PAYMENT_METHOD";
    session.customer.fullName = "Test User";
    await saveCheckoutSession(session);

    // Passo 1: Escolhe dinheiro
    await handleCheckoutTurn({ companyId, phone, text: "3" });
    
    // Passo 2: Responde "não" para troco
    const turn = await handleCheckoutTurn({ companyId, phone, text: "não" });
    expect(turn?.step).toBe("WAITING_DOCUMENT");
  });

  it("TESTE D — DINHEIRO COM TROCO", async () => {
    const session = createCheckoutSession(companyId, phone);
    session.step = "WAITING_PAYMENT_METHOD";
    session.customer.fullName = "Test User";
    await saveCheckoutSession(session);

    await handleCheckoutTurn({ companyId, phone, text: "3" });
    const turn = await handleCheckoutTurn({ companyId, phone, text: "50" });
    
    expect(turn?.step).toBe("WAITING_DOCUMENT");
    expect(turn?.session?.changeAmount).toBe(50);
    expect(turn?.session?.changeNeeded).toBe(true);
  });

  it("TESTE E — TROCO INSUFICIENTE", async () => {
    const session = createCheckoutSession(companyId, phone);
    session.step = "WAITING_PAYMENT_METHOD";
    session.customer.fullName = "Test User";
    await saveCheckoutSession(session);

    await handleCheckoutTurn({ companyId, phone, text: "3" });
    const turn = await handleCheckoutTurn({ companyId, phone, text: "40" });
    
    expect(turn?.step).toBe("WAITING_CHANGE_INFO");
    expect(turn?.text).toContain("precisa ser igual ou maior que o total");
  });
});
