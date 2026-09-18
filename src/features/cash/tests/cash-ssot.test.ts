import { describe, it, expect, vi } from "vitest";
import { cashService } from "../services/cash.service";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => {
  const createMockChain = () => {
    const mock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
      then: vi.fn(),
    };
    
    // Configura o comportamento padrão de promise para as chamadas em Promise.all
    mock.then.mockImplementation(function(onfulfilled) {
      return Promise.resolve({ data: [], error: null }).then(onfulfilled);
    });

    return mock;
  };

  const viewMock = createMockChain();
  viewMock.single.mockResolvedValue({ 
    data: { 
      opening_balance: 100,
      cash_in: 50,
      cash_out: 20,
      cash_sales: 200,
      sales_total: 500,
      sales_count: 5,
      expected_cash: 330
    }, 
    error: null 
  });

  const genericMock = createMockChain();

  return {
    supabase: {
      from: vi.fn((table) => {
        if (table === "view_cash_session_summary") return viewMock;
        return genericMock;
      }),
      rpc: vi.fn().mockResolvedValue({
        data: {
          id: "sess-1",
          company_id: "comp-1",
          status: "closed",
          opened_at: "2026-09-18T10:00:00.000Z",
          closed_at: "2026-09-18T18:00:00.000Z",
          counted_cash: 330,
          expected_cash: 330,
        },
        error: null,
      }),
    }
  };
});

describe("Cash Single Source of Truth", () => {
  it("should use view_cash_session_summary for totals", async () => {
    const session = { id: "sess-1", company_id: "comp-1", opened_at: new Date().toISOString() } as any;
    const summary = await cashService.computeSummary(session);
    
    expect(summary.expectedCash).toBe(330);
    expect(summary.salesTotal).toBe(500);
    expect(summary.openingBalance).toBe(100);
    expect(supabase.from).toHaveBeenCalledWith("view_cash_session_summary");
  });

  it("closes through the atomic database function before loading details", async () => {
    const result = await cashService.closeSession({
      sessionId: "sess-1",
      countedCash: 330,
      closingNote: "Conferido",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("close_cash_session", {
      _session_id: "sess-1",
      _counted_cash: 330,
      _closing_note: "Conferido",
    });
    expect(result.session.status).toBe("closed");
    expect(result.summary.expectedCash).toBe(330);
  });
});
