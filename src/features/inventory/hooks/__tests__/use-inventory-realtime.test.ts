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

const PDV_FULL = ["pdv", "catalog-index", "full", "company-1"];

function setup(opts: { withPdv?: boolean; activeKeys?: string[][] } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  if (opts.withPdv) {
    qc.setQueryData(PDV_FULL, [
      { id: "p1", name: "Bolsa", price: 89.9, stock: 3, sku: null, barcode: null },
      { id: "p2", name: "Carteira", price: 49.9, stock: 1, sku: null, barcode: null },
    ]);
  }
  const invalidate = vi.spyOn(qc, "invalidateQueries").mockResolvedValue();
  const remove = vi.spyOn(qc, "removeQueries");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  const hook = renderHook(() => useInventoryRealtime("company-1"), { wrapper });
  return { qc, invalidate, remove, hook };
}

const invalidatedKeys = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.map((c: any[]) => c[0].queryKey.join("/"));

const productEvent = (eventType: string, row: Record<string, unknown>) => ({
  eventType,
  new: eventType === "DELETE" ? {} : row,
  old: { id: row.id },
});

describe("useInventoryRealtime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    channelState.handlers = [];
    channelState.onStatus = null;
    channelState.removed = 0;
  });
  afterEach(() => vi.useRealTimers());

  it("escuta só produtos da empresa (movimentações já atualizam products.stock)", () => {
    setup();
    expect(channelState.handlers.map((h) => [h.table, h.event, h.filter])).toEqual([
      ["products", "*", "company_id=eq.company-1"],
    ]);
  });

  it("venda (rajada de eventos) atualiza o PDV na memória, sem recarregar o catálogo", () => {
    const { qc, invalidate } = setup({ withPdv: true });
    const cb = channelState.handlers[0].cb;
    cb(
      productEvent("UPDATE", { id: "p1", name: "Bolsa", price: 89.9, stock: 2, status: "active" }),
    );
    cb(
      productEvent("UPDATE", { id: "p1", name: "Bolsa", price: 89.9, stock: 1, status: "active" }),
    );
    cb(
      productEvent("UPDATE", {
        id: "p2",
        name: "Carteira",
        price: 59.9,
        stock: 0,
        status: "active",
      }),
    );
    expect(invalidate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);

    const pdv = qc.getQueryData<any[]>(PDV_FULL)!;
    expect(pdv.find((p) => p.id === "p1")).toMatchObject({ stock: 1, price: 89.9 });
    expect(pdv.find((p) => p.id === "p2")).toMatchObject({ stock: 0, price: 59.9 });
    // Catálogo do PDV NÃO é recarregado; os demais caches recarregam só se ativos.
    expect(invalidatedKeys(invalidate)).toEqual([
      "products",
      "inventory",
      "inv-product-picker",
      "accounting-ai/summary",
    ]);
    for (const call of invalidate.mock.calls as any[]) {
      expect(call[0].refetchType).toBe("active");
    }
  });

  it("produto inativado ou removido sai do catálogo do PDV", () => {
    const { qc } = setup({ withPdv: true });
    const cb = channelState.handlers[0].cb;
    cb(productEvent("UPDATE", { id: "p1", name: "Bolsa", status: "inactive" }));
    cb(productEvent("DELETE", { id: "p2" }));
    vi.advanceTimersByTime(500);
    expect(qc.getQueryData<any[]>(PDV_FULL)).toEqual([]);
  });

  it("produto novo recarrega o catálogo do PDV", () => {
    const { invalidate } = setup({ withPdv: true });
    channelState.handlers[0].cb(
      productEvent("INSERT", { id: "p3", name: "Cinto", price: 39.9, stock: 5, status: "active" }),
    );
    vi.advanceTimersByTime(500);
    expect(invalidatedKeys(invalidate)).toContain("pdv/catalog-index");
  });

  it("produto alterado fora do catálogo em memória (catálogo grande) não recarrega o PDV", () => {
    const { invalidate } = setup({ withPdv: true });
    channelState.handlers[0].cb(
      productEvent("UPDATE", { id: "p999", name: "Outro", stock: 4, status: "active" }),
    );
    vi.advanceTimersByTime(500);
    expect(invalidatedKeys(invalidate)).not.toContain("pdv/catalog-index");
  });

  it("descarta caches inativos em vez de recarregá-los", () => {
    const { remove } = setup();
    channelState.handlers[0].cb(productEvent("UPDATE", { id: "p1", stock: 1, status: "active" }));
    vi.advanceTimersByTime(500);
    expect(remove.mock.calls.every((c: any[]) => c[0].type === "inactive")).toBe(true);
    expect(remove).toHaveBeenCalled();
  });

  it("recarrega tudo (inclusive PDV) ao reconectar, mas não na primeira conexão", () => {
    const { invalidate } = setup();
    channelState.onStatus?.("SUBSCRIBED");
    vi.advanceTimersByTime(500);
    expect(invalidate).not.toHaveBeenCalled();
    channelState.onStatus?.("SUBSCRIBED");
    vi.advanceTimersByTime(500);
    expect(invalidatedKeys(invalidate)).toContain("pdv/catalog-index");
  });

  it("desliga a escuta ao sair", () => {
    const { hook } = setup();
    hook.unmount();
    expect(channelState.removed).toBe(1);
  });
});
