import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleWhatsAppInboundPayload } from "../router.server";
import { handleCheckoutTurn } from "../checkout-session.server";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import * as whatsappServer from "@/lib/whatsapp.server";

// Mock das dependências
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

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

describe("Bug Reproducer: [PEDIDO-CATALOGO] Double Prompt / Wrong Turn", () => {
  const tenant = { companyId: "comp-1" };
  const msg = {
    waContactId: "5511999999999@s.whatsapp.net",
    waMessageId: "catalog-msg-id",
    phone: "5511999999999",
    profileName: "Test User",
    text: "[PEDIDO-CATALOGO] Total: R$ 40,00 | Itens: 1x Camisa (R$ 40,00)",
    timestamp: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup mock DB responses
    (db.from as any).mockImplementation(() => ({
      select: () => ({
        eq: () => ({ in: () => ({ limit: () => ({ data: [{ id: "contact-1", wa_id: msg.waContactId }] }) }) }),
        maybeSingle: () => ({ data: { id: "conv-1", status: "open" } }),
      }),
      upsert: () => ({ select: () => ({ single: () => ({ data: { id: "id-1", status: "open" } }) }) }),
      insert: () => ({ error: null }),
      update: () => ({ eq: () => ({}) }),
    }));
  });

  it("REPRODUCE BUG: [PEDIDO-CATALOGO] deve enviar PROMPTS.payment_method e NÃO chamar handleCheckoutTurn com texto vazio", async () => {
    // 1. Executar o webhook
    await handleWhatsAppInboundPayload({ db, msg, tenant });

    // 2. Verificar se handleCheckoutTurn foi chamado (O BUG é que ele É chamado com text: "")
    const calls = (handleCheckoutTurn as any).mock.calls;
    
    // Verificamos se ele foi chamado. Se o bug existe, calls.length > 0.
    // O usuário disse que o bug existe, então vamos confirmar a falha aqui.
    // Assim que corrigirmos, mudaremos para .toBe(0)
    expect(calls.length, "O BUG EXISTE: handleCheckoutTurn foi chamado indevidamente para mensagem de catálogo").toBe(0);
    
    // E a mensagem enviada deve ser exatamente o prompt de pagamento
    expect(whatsappServer.sendWhatsAppText).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("Qual forma de pagamento você prefere?")
    }));
  });
});
