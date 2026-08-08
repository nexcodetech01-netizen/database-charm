import { describe, it, expect, vi } from "vitest";
import { cashService } from "../services/cash.service";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
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
          })),
          in: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null }))
          })),
          or: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  }
}));

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
