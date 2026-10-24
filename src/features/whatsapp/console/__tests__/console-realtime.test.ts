/**
 * Console WhatsApp — rajadas de eventos do Realtime viram poucas recargas.
 */
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (payload: unknown) => unknown;
const state = vi.hoisted(() => ({
  handlers: [] as Array<{ table: string; cb: Handler }>,
  removed: 0,
  contactName: "Ana" as string | null,
}));

vi.mock("@/integrations/supabase/client", () => {
  const channel: any = {
    on: (_t: string, opts: any, cb: Handler) => {
      state.handlers.push({ table: opts.table, cb });
      return channel;
    },
    subscribe: () => channel,
  };
  const query: any = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: { id: "c1", contact: { profile_name: state.contactName } } }),
  };
  return {
    supabase: {
      channel: () => channel,
      removeChannel: () => {
        state.removed++;
      },
      from: () => query,
    },
  };
});

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("../service.functions", () => ({}));

import { useConsoleRealtime } from "../hooks";

function setup(onNew?: (m: unknown) => void) {
  const qc = new QueryClient();
  const invalidate = vi.spyOn(qc, "invalidateQueries").mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  const hook = renderHook(() => useConsoleRealtime("co-1", onNew), { wrapper });
  return { invalidate, hook };
}

const keys = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.map((c: any[]) => c[0].queryKey.join("/"));

const conv = () => state.handlers.find((h) => h.table === "whatsapp_conversations")!.cb;
const msgs = () => state.handlers.find((h) => h.table === "whatsapp_messages")!.cb;

describe("useConsoleRealtime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.handlers = [];
    state.removed = 0;
    state.contactName = "Ana";
  });
  afterEach(() => vi.useRealTimers());

  it("rajada de uma troca com a Bella vira 1 recarga de cada coisa", async () => {
    const { invalidate } = setup();
    // mensagem do cliente + resposta da Bella + 2 atualizações da conversa
    await msgs()({ new: { conversation_id: "c1", direction: "outbound" } });
    await msgs()({ new: { conversation_id: "c1", direction: "outbound" } });
    conv()({ new: { id: "c1" } });
    conv()({ new: { id: "c1" } });
    expect(invalidate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(keys(invalidate)).toEqual(["whatsapp-console/detail/c1"]);

    vi.advanceTimersByTime(500);
    expect(keys(invalidate)).toEqual(["whatsapp-console/detail/c1", "whatsapp-console/list/co-1"]);

    vi.advanceTimersByTime(10_000);
    expect(keys(invalidate)).toEqual([
      "whatsapp-console/detail/c1",
      "whatsapp-console/list/co-1",
      "whatsapp-console/metrics/co-1",
    ]);
  });

  it("notifica só mensagem recebida, com o nome do contato", async () => {
    const onNew = vi.fn();
    setup(onNew);
    await msgs()({
      new: { conversation_id: "c1", direction: "outbound", text: "resposta da Bella" },
    });
    expect(onNew).not.toHaveBeenCalled();
    await msgs()({ new: { conversation_id: "c1", direction: "inbound", text: "oi" } });
    expect(onNew).toHaveBeenCalledWith({ conversation_id: "c1", text: "oi", contact_name: "Ana" });
  });

  it("sem nome cadastrado usa 'Cliente'", async () => {
    state.contactName = null;
    const onNew = vi.fn();
    setup(onNew);
    await msgs()({ new: { conversation_id: "c1", direction: "inbound", text: "oi" } });
    expect(onNew).toHaveBeenCalledWith(expect.objectContaining({ contact_name: "Cliente" }));
  });

  it("desliga o canal e os timers ao sair", () => {
    const { hook, invalidate } = setup();
    conv()({ new: { id: "c1" } });
    hook.unmount();
    vi.advanceTimersByTime(20_000);
    expect(state.removed).toBe(1);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
