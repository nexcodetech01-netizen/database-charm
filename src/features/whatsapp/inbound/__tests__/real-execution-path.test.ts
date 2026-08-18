import { supabaseAdminMock } from "./session-store.mock";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: supabaseAdminMock,
}));


import { describe, it, expect, vi } from "vitest";
import { handleCheckoutTurn, saveCheckoutSession, resetCheckoutSessions } from "../checkout-session.server";
import { createCheckoutSession } from "../checkout-session";
import { saveCartSession, resetCartSessions } from "../cart-session.server";
import type { CartSession } from "../cart-session";

describe("Real Execution Path - Pedido Catálogo", () => {
  const companyId = "real-test-comp";
  const phone = "5511999999999";
  
  const mockCart: CartSession = {
    companyId,
    phone,
    items: [
      { productId: "p1", name: "Produto Teste", qty: 1, unitPrice: 100, subtotal: 100 }
    ],
    total: 100,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it("whatsapp inbound → handleCheckoutTurn → handlerSelected: scenario [PEDIDO-CATALOGO] com pagamento em dinheiro", async () => {
    await resetCheckoutSessions();
    await resetCartSessions();
    
    // Simula o estado após o usuário colar o [PEDIDO-CATALOGO] no WhatsApp
    // No router.server.ts, isso cria a sessão e define o step como WAITING_PAYMENT_METHOD
    await saveCartSession(mockCart);
    const session = createCheckoutSession(companyId, phone);
    session.step = "WAITING_PAYMENT_METHOD";
    session.customer.fullName = "Test User"; // Simula nome já presente (comum em catálogo)
    await saveCheckoutSession(session);
    
    console.log("[CATALOG CHECKOUT TEST] Início do fluxo real");
    
    // O usuário responde "Dinheiro"
    const turn = await handleCheckoutTurn({
      companyId,
      phone,
      text: "Dinheiro",
      cart: mockCart
    });

    // Verificações do caminho real
    expect(turn).not.toBeNull();
    expect(turn?.step).toBe("WAITING_CHANGE_INFO");
    expect(turn?.text).toContain("Você vai precisar de troco?");
    
    console.log("[CATALOG CHECKOUT TEST] Resposta interceptada com sucesso pelo checkout-session");
    
    // Responde "não" para troco
    const turn2 = await handleCheckoutTurn({
        companyId,
        phone,
        text: "não",
        cart: mockCart
    });

    expect(turn2?.step).toBe("WAITING_DOCUMENT");
    expect(turn2?.text).toContain("CPF");
    
    console.log("[CATALOG CHECKOUT TEST] Fluxo avançou para WAITING_DOCUMENT");
  });

  it("Garantir que variantes de pagamento sejam sempre tratadas pelo checkout", async () => {
    const variants = ["Dinheiro", "Pix", "Cartão", "cartao", "credito"];
    
    for (const v of variants) {
      await resetCheckoutSessions();
      const session = createCheckoutSession(companyId, phone);
      session.step = "WAITING_PAYMENT_METHOD";
      session.customer.fullName = "Test User";
      await saveCheckoutSession(session);
      
      const turn = await handleCheckoutTurn({
        companyId,
        phone,
        text: v,
        cart: mockCart
      });
      
      const isCash = v.toLowerCase().includes("dinheiro");
      expect(turn?.step, `Falhou para a variante: ${v}`).toBe(isCash ? "WAITING_CHANGE_INFO" : "WAITING_DOCUMENT");
    }
  });
});
