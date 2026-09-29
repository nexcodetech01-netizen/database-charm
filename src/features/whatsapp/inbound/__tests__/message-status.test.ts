import { describe, expect, it, vi } from "vitest";
import { applyWhatsAppStatus, shouldApplyStatus } from "../message-status";

function fakeDb(existing: { id: string; status: string | null } | null) {
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
  const select = vi.fn(() => {
    const chain: any = {
      eq: () => chain,
      maybeSingle: () => Promise.resolve({ data: existing, error: null }),
    };
    return chain;
  });
  return { db: { from: vi.fn(() => ({ select, update })) }, update };
}

describe("shouldApplyStatus", () => {
  it("só avança: sent → delivered → read", () => {
    expect(shouldApplyStatus("sent", "delivered")).toBe(true);
    expect(shouldApplyStatus("delivered", "read")).toBe(true);
    expect(shouldApplyStatus("read", "delivered")).toBe(false); // chegou fora de ordem
    expect(shouldApplyStatus("delivered", "delivered")).toBe(false);
  });

  it("falha sempre vale, e nada sobrescreve uma falha", () => {
    expect(shouldApplyStatus("sent", "failed")).toBe(true);
    expect(shouldApplyStatus("failed", "read")).toBe(false);
  });

  it("ignora status desconhecido", () => {
    expect(shouldApplyStatus("sent", "deleted")).toBe(false);
  });
});

describe("applyWhatsAppStatus", () => {
  const tenant = { companyId: "c1" };

  it("atualiza a mensagem enviada quando a Meta avisa que foi lida", async () => {
    const { db, update } = fakeDb({ id: "m1", status: "sent" });
    const result = await applyWhatsAppStatus({
      db,
      tenant,
      status: { id: "wamid.1", status: "read" },
    });
    expect(result).toBe("read");
    expect(update).toHaveBeenCalledWith({ status: "read" });
  });

  it("grava o motivo quando a entrega falha", async () => {
    const { db, update } = fakeDb({ id: "m1", status: "sent" });
    await applyWhatsAppStatus({
      db,
      tenant,
      status: {
        id: "wamid.1",
        status: "failed",
        errors: [{ code: 131047, title: "Re-engagement message" }],
      },
    });
    expect(update).toHaveBeenCalledWith({
      status: "failed",
      error: "131047 — Re-engagement message",
    });
  });

  it("não quebra quando a mensagem não é nossa", async () => {
    const { db, update } = fakeDb(null);
    await expect(
      applyWhatsAppStatus({ db, tenant, status: { id: "wamid.x", status: "delivered" } }),
    ).resolves.toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});
