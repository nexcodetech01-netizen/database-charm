import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let calls = 0;
const summary = () => ({
  today: "2026-10-21",
  cells: { income_overdue: { total: 100, count: 1 } },
  overdue_receivables: [],
  receivables_due: [],
  payables_due: [],
  v: ++calls,
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: async () => ({ data: summary(), error: null }), from: () => ({}), auth: {}, storage: {} },
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("resumo financeiro do dia", () => {
  it("abre uma vez e não reabre quando o Financeiro recarrega", async () => {
    const { DailyFinanceSummaryDialog } = await import("../daily-finance-summary-dialog");
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <DailyFinanceSummaryDialog companyId="co" />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await act(async () => {
      await qc.invalidateQueries({ queryKey: ["finance"] });
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(calls).toBeGreaterThan(1);
  });
});
