import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Cliente com `this` obrigatório, como o supabase-js (this.rest).
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rest: { ok: true },
    rpc(this: { rest?: unknown }, fn: string) {
      if (!this?.rest) throw new TypeError("Cannot read properties of undefined (reading 'rest')");
      return Promise.resolve({
        data: [{ code: fn, severity: "info", title: "t", detail: "d", ref_type: "page", ref_id: null, ref_label: "/vendas" }],
        error: null,
      });
    },
  },
}));

import { useSystemHealth } from "../use-system-health";

describe("useSystemHealth", () => {
  it("chama a RPC sem perder o cliente", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSystemHealth("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].code).toBe("system_health_checks");
  });
});
