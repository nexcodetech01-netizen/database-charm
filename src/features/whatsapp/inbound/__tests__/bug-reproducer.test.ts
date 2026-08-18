import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleWhatsAppInboundPayload } from "../router.server";
import { handleCheckoutTurn } from "../checkout-session.server";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import * as whatsappServer from "@/lib/whatsapp.server";

// Mock das dependências
vi.mock("@/integrations/supabase/client.server", () => {
  const mockChain = () => {
    const chain: any = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: { id: "conv-1", status: "open" } })),
      single: vi.fn().mockImplementation(() => Promise.resolve({ data: { id: "id-1", status: "open" } })),
      neq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
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

// Mock do checkout-session.server para rastrear chamadas
vi.mock("../checkout-session.server", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    handleCheckoutTurn: vi.fn().mockImplementation(actual.handleCheckoutTurn),
  };
});

describe("Bug Fix Verification: [PEDIDO-CATALOGO] Flow", () => {
  const tenant = { companyId: "comp-1" };
  const msg = {
    waContactId: "5511999999999@s.whatsapp.net",
    waMessageId: "catalog-msg-id",
    phone: "5511999999999",
    profileName: "Test User",
    text: "[PEDIDO-CATALOGO] Total: R$ 40,00 | Itens: 1x Camisa (R$ 40,00) | Nome: Test User",
    timestamp: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("FIXED: [PEDIDO-CATALOGO] deve enviar PROMPTS.payment_method e NÃO chamar handleCheckoutTurn", async () => {
    await handleWhatsAppInboundPayload({ db, msg, tenant });

    const calls = (handleCheckoutTurn as any).mock.calls;
    
    // VERIFICAÇÃO PRINCIPAL: handleCheckoutTurn não deve ser chamado no processamento inicial do catálogo
    expect(calls.length, "FIXED: handleCheckoutTurn não deve ser chamado para mensagem de catálogo").toBe(0);
    
    // VERIFICAÇÃO DO PROMPT: deve ser enviado o prompt de pagamento correto
    expect(whatsappServer.sendWhatsAppText).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("Qual forma de pagamento você prefere?")
    }));
  });

  it("DEFESA: handleCheckoutTurn deve ignorar mensagens de catálogo se chamadas por engano", async () => {
    // Chamada direta simulando erro de roteamento
    const result = await handleCheckoutTurn({
      companyId: tenant.companyId,
      phone: msg.phone,
      text: msg.text
    });

    expect(result).toBeNull();
  });
});
