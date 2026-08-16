import { describe, it, expect, vi, beforeEach } from "vitest";
import { getInboxChannel, broadcastInboxEvent } from "../inbox-sync";

// Mock do BroadcastChannel
class BroadcastChannelMock {
  name: string;
  onmessage: ((ev: MessageEvent) => any) | null = null;
  constructor(name: string) {
    this.name = name;
  }
  postMessage(data: any) {
    // Simula o recebimento em outras instâncias (aqui no mesmo processo de teste)
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
  }
  addEventListener(type: string, listener: any) {
    if (type === "message") this.onmessage = listener;
  }
  removeEventListener(type: string, listener: any) {
    if (type === "message") this.onmessage = null;
  }
  close() {}
}

vi.stubGlobal("BroadcastChannel", BroadcastChannelMock);

describe("Inbox Sync & BroadcastChannel E2E", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve sincronizar evento de pedido recebido entre abas", () => {
    const channel = getInboxChannel();
    const spy = vi.fn();
    
    channel?.addEventListener("message", (ev: MessageEvent) => {
      spy(ev.data);
    });

    const event = { 
      type: "CATALOG_ORDER_RECEIVED" as const, 
      payload: { ticketId: "t1", buyerName: "Test", total: 100 } 
    };

    broadcastInboxEvent(event);

    expect(spy).toHaveBeenCalledWith(event);
  });

  it("deve sincronizar resolução de pedido para limpar notificações em outras abas", () => {
    const channel = getInboxChannel();
    const spy = vi.fn();
    
    channel?.addEventListener("message", (ev: MessageEvent) => {
      spy(ev.data);
    });

    const event = { 
      type: "CATALOG_ORDER_RESOLVED" as const, 
      payload: { ticketId: "t1" } 
    };

    broadcastInboxEvent(event);

    expect(spy).toHaveBeenCalledWith(event);
  });

  it("deve sincronizar o contador global entre sessões", () => {
    const channel = getInboxChannel();
    const spy = vi.fn();
    
    channel?.addEventListener("message", (ev: MessageEvent) => {
      spy(ev.data);
    });

    const event = { 
      type: "SYNC_COUNT" as const, 
      payload: { count: 5 } 
    };

    broadcastInboxEvent(event);

    expect(spy).toHaveBeenCalledWith(event);
    expect(spy.mock.calls[0][0].payload.count).toBe(5);
  });
});
