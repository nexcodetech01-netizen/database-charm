import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/whatsapp.server", () => ({ sendWhatsAppText: vi.fn() }));

import { handleWhatsAppInboundPayload } from "../router.server";

describe("handleWhatsAppInboundPayload — evento só de status", () => {
  it("não quebra e atualiza o status da mensagem (antes: TypeError em msg.waContactId)", async () => {
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    const chain: any = {
      eq: () => chain,
      maybeSingle: () => Promise.resolve({ data: { id: "m1", status: "sent" }, error: null }),
    };
    const db = { from: vi.fn(() => ({ select: () => chain, update })) };

    await expect(
      handleWhatsAppInboundPayload({
        db,
        msg: null,
        status: { id: "wamid.1", status: "delivered" },
        tenant: { companyId: "c1" },
        startedAt: Date.now(),
      }),
    ).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith({ status: "delivered" });
  });
});
