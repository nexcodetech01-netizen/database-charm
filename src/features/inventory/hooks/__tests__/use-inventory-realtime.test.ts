import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (payload?: unknown) => void;
const channelState = vi.hoisted(() => ({
  handlers: [] as Array<{ table: string; event: string; filter: string; cb: Handler }>,
  onStatus: null as ((status: string) => void) | null,
  removed: 0,
}));

vi.mock("@/integrations/supabase/client", () => {
  const channel: any = {
    on: (_type: string, opts: any, cb: Handler) => {
      channelState.handlers.push({ table: opts.table, event: opts.event, filter: opts.filter, cb });
      return channel;
    },
    subscribe: (cb: (status: string) => void) => {
      channelState.onStatus = cb;
      return channel;
    },
  };
  return {
    supabase: {
      channel: () => channel,
      removeChannel: () => {
        channelState.removed++;
      },
    },
  };
});

import { useInventoryRealtime } from "../use-inventory-realtime";

function setup() {
  const qc = new QueryClient();
  const invalidate = vi.spyOn(qc, "invalidateQueries").mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  const hook = renderHook(() => useInventoryRealtime("company-1"), { wrapper });
  return { invalidate, hook };
}

const invalidatedKeys = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.map((c: any[]) => c[0].queryKey.join("/"));

describe("useInventoryRealtime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    channelState.handlers = [];
    channelState.onStatus = null;
    channelState.removed = 0;
  });
  afterEach(() => vi.useRealTimers());

  it("escuta produtos e movimentações só da empresa", () => {
    setup();
    expect(channelState.handlers.map((h) => [h.table, h.event, h.filter])).toEqual([
      ["products", "*", "company_id=eq.company-1"],
      ["inventory_movements", "INSERT", "company_id=eq.company-1"],
    ]);
  });

  it("venda de outra pessoa (rajada de eventos) recarrega o estoque uma vez", () => {
    const { invalidate } = setup();
    channelState.handlers[1].cb();
    channelState.handlers[1].cb();
    channelState.handlers[0].cb();
    expect(invalidate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(invalidatedKeys(invalidate)).toEqual([
      "products",
      "inventory",
      "inv-product-picker",
      "pdv/catalog-index",
      "accounting-ai/summary",
    ]);
  });

  it("recarrega ao reconectar, mas não na primeira conexão", () => {
    const { invalidate } = setup();
    channelState.onStatus?.("SUBSCRIBED");
    vi.advanceTimersByTime(500);
    expect(invalidate).not.toHaveBeenCalled();
    channelState.onStatus?.("SUBSCRIBED");
    vi.advanceTimersByTime(500);
    expect(invalidate).toHaveBeenCalled();
  });

  it("desliga a escuta ao sair", () => {
    const { hook } = setup();
    hook.unmount();
    expect(channelState.removed).toBe(1);
  });
});
