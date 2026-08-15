import { describe, it, expect, beforeEach, vi } from "vitest";

// MOCK COMPLETO E EXPLÍCITO SEM IMPORTS PROBLEMÁTICOS
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  },
}));

vi.mock("../checkout-session.server", () => ({
  peekCheckoutSession: vi.fn(),
  dropCheckoutSession: vi.fn(),
}));

vi.mock("../cart-session.server", () => ({
  getCartSession: vi.fn(),
  saveCartSession: vi.fn(),
  clearCartSession: vi.fn(c => c),
}));

// Mockamos o event-bus usando APENAS o alias @ para simplificar a vida do Vitest
vi.mock("@/features/bella-ai/agent/infrastructure/event-bus", () => ({
  emitAgentEvent: vi.fn().mockResolvedValue({ success: true }),
}));

// IMPORTANTE: NÃO IMPORTAMOS "../../bella-ai/agent/infrastructure/event-bus"
// O service usa path relativo, o Vitest deve ser capaz de mapear o mock do alias @ para o arquivo real
// se o tsconfig estiver correto, ou nós mockamos o path relativo sem importar no teste.

vi.mock("../../bella-ai/agent/infrastructure/event-bus", () => ({
  emitAgentEvent: vi.fn().mockResolvedValue({ success: true }),
}));

import { handleCommercialConfirmationTurn } from "../commercial-inbox.server";
import { peekCheckoutSession } from "../checkout-session.server";
import { getCartSession } from "../cart-session.server";

describe("Catalog Order Notification (Sprint 8.4)", () => {
  const companyId = "test-company";
  const phone = "5511999999999";
  const now = Date.now();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve processar o fechamento com sucesso", async () => {
    const db = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    const session = {
      companyId,
      phone,
      step: "summary",
      buyerName: "João Teste",
      customer: { fullName: "João Teste" },
      delivery: {},
      fulfillment: "pickup",
      payment: "pix",
      expiresAt: now + 10000,
      deliveryFee: 0,
      totalWithFreight: 10,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    const cart = {
      items: [{ productId: "p1", name: "Prod 1", qty: 1, unitPrice: 10, subtotal: 10 }],
      total: 10,
    };

    vi.mocked(peekCheckoutSession).mockResolvedValue(session as any);
    vi.mocked(getCartSession).mockResolvedValue(cart as any);
    db.maybeSingle.mockResolvedValue({ data: null }); 
    db.single.mockResolvedValue({ data: { id: "ticket-123" } }); 

    const result = await handleCommercialConfirmationTurn({
      db: db as any,
      companyId,
      phone,
      text: "sim",
      now,
    });

    expect(result?.created).toBe(true);
    expect(result?.ticketId).toBe("ticket-123");
  });

  it("deve ignorar mensagens comuns", async () => {
    vi.mocked(peekCheckoutSession).mockResolvedValue({ step: "waiting_name" } as any);
    const result = await handleCommercialConfirmationTurn({
      db: {} as any,
      companyId,
      phone,
      text: "Olá",
      now,
    });
    expect(result).toBe(null);
  });
});
