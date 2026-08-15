import { describe, it, expect, beforeEach, vi } from "vitest";

// Para depurar o path, vamos logar onde estamos
console.log("[TEST DEBUG] CWD:", process.cwd());

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
}));

// Importamos usando o alias @/ que é global
import { handleCommercialConfirmationTurn } from "../commercial-inbox.server";
import { bellaEventEngine } from "@/features/bella-ai/events/BellaEventEngine";
import { peekCheckoutSession } from "../checkout-session.server";
import { getCartSession } from "../cart-session.server";

describe("Catalog Order Notification (Sprint 8.4)", () => {
  const companyId = "test-company";
  const phone = "5511999999999";
  const now = Date.now();

  beforeEach(() => {
    vi.clearAllMocks();
    bellaEventEngine.clear();
  });

  it("deve disparar evento CATALOG_ORDER_RECEIVED apenas na criação", async () => {
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

    await handleCommercialConfirmationTurn({
      db: db as any,
      companyId,
      phone,
      text: "sim",
      now,
    });

    const events = bellaEventEngine.list({ tenantId: companyId, type: "catalog.order.received" });
    expect(events).toHaveLength(1);
    expect(events[0].payload.entityId).toBe("ticket-123");
  });

  it("deve ignorar mensagens comuns", async () => {
    vi.mocked(peekCheckoutSession).mockResolvedValue({ step: "waiting_name" } as any);
    await handleCommercialConfirmationTurn({
      db: {} as any,
      companyId,
      phone,
      text: "Olá",
      now,
    });
    
    const events = bellaEventEngine.list({ tenantId: companyId });
    expect(events).toHaveLength(0);
  });
});
