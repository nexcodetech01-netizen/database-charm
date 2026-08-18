import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleWhatsAppInboundPayload } from "../router.server";
import { handleCheckoutTurn } from "../checkout-session.server";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import * as whatsappServer from "@/lib/whatsapp.server";
import { getCartSession } from "../cart-session.server";
import { peekCheckoutSession } from "../checkout-session.server";

// Mock das dependências
vi.mock("@/integrations/supabase/client.server", () => {
  const store: Record<string, any> = {};
  const mockChain = () => {
    const chain: any = {
      from: vi.fn().mockImplementation((table) => {
        return {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          upsert: vi.fn().mockImplementation((data) => {
            if (table === "whatsapp_checkout_sessions") {
               store[`checkout:${data.phone}`] = data.session_data;
            } else if (table === "whatsapp_cart_sessions") {
               store[`cart:${data.phone}`] = data.session_data;
            }
            return Promise.resolve({ data, error: null });
          }),
          insert: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() => {
            if (table === "whatsapp_checkout_sessions") {
              // Extract phone from mock calls if needed, but for simple test we know it
              return Promise.resolve({ data: { session_data: store[`checkout:5511999999999`] } });
            }
            if (table === "whatsapp_cart_sessions") {
                return Promise.resolve({ data: { session_data: store[`cart:5511999999999`] } });
            }
            return Promise.resolve({ data: { id: "conv-1", status: "open" } });
          }),
          single: vi.fn().mockImplementation(() => Promise.resolve({ data: { id: "id-1", status: "open" } })),
          neq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        };
      }),
    };
    return chain;
  };
  
  return {
    supabaseAdmin: mockChain(),
  };
});

vi.mock("@/lib/whatsapp.server", () => ({
  sendWhatsAppText: vi.fn().mockResolvedValue({ ok: true, waMessageId: "msg-123" }),
}));

describe("Final Fix Verification: Greeting and Freight", () => {
  const tenant = { companyId: "comp-1" };
  const catalogMsg = {
    waContactId: "5511999999999@s.whatsapp.net",
    waMessageId: "catalog-msg-id",
    phone: "5511999999999",
    profileName: "Test User",
    text: "[PEDIDO-CATALOGO]\n\nProduto:\nCarteira Masculina Texturizada - Arthur Preto — 1 un. — R$ 40,00\n\nTotal dos produtos: R$ 40,00\n\nForma de recebimento: Entrega em Tupã\nTaxa de entrega: R$ 5,00\n\nNome: Test User",
    timestamp: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Deve enviar saudação + confirmação + pagamento em UMA única mensagem", async () => {
    await handleWhatsAppInboundPayload({ db, msg: catalogMsg, tenant });

    expect(whatsappServer.sendWhatsAppText).toHaveBeenCalledTimes(1);
    const sentText = (whatsappServer.sendWhatsAppText as any).mock.calls[0][0].text;
    
    // Verifica saudação (conforme America/Sao_Paulo)
    expect(sentText).toMatch(/(Bom dia|Boa tarde|Boa noite)!/);
    expect(sentText).toContain("Recebi seu pedido do catálogo! 🛍️");
    expect(sentText).toContain("Qual forma de pagamento você prefere? 😊");
  });

  it("2. Deve preservar o frete de R$ 5,00 na sessão", async () => {
    await handleWhatsAppInboundPayload({ db, msg: catalogMsg, tenant });
    
    const session = await peekCheckoutSession(tenant.companyId, catalogMsg.phone);
    expect(session?.deliveryFee).toBe(5);
    
    const cart = await getCartSession(tenant.companyId, catalogMsg.phone);
    expect(cart.total).toBe(40); // subtotal dos itens
  });

  it("3. Troco para R$ 50,00 deve ser validado contra Total R$ 45,00 (40+5)", async () => {
    // 1. Recebe catálogo
    await handleWhatsAppInboundPayload({ db, msg: catalogMsg, tenant });
    
    // 2. Cliente responde "3" (Dinheiro)
    await handleWhatsAppInboundPayload({ db, msg: { ...catalogMsg, text: "3" }, tenant });
    
    // 3. Cliente responde "50"
    await handleWhatsAppInboundPayload({ db, msg: { ...catalogMsg, text: "50" }, tenant });
    
    const lastSent = (whatsappServer.sendWhatsAppText as any).mock.calls.at(-1)[0].text;
    
    // Se aceitou os 50, ele deve ter avançado para DOCUMENTO
    expect(lastSent).toContain("CPF");
    
    // Se tivesse falhado (validando contra 40), estaria pedindo troco de novo com erro
    expect(lastSent).not.toContain("precisa ser igual ou maior que o total");
    
    const session = await peekCheckoutSession(tenant.companyId, catalogMsg.phone);
    expect(session?.step).toBe("WAITING_DOCUMENT");
    expect(session?.changeAmount).toBe(50);
  });
});