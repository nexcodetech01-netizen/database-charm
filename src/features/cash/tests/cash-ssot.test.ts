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
      })
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
});
