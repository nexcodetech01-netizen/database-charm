import { beforeEach, describe, expect, it, vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));

import { addDays, bankReconciliationService, spDay } from "../bank-reconciliation.service";

describe("bank reconciliation service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the São Paulo date rather than the UTC date", () => {
    expect(spDay("2026-10-09T02:59:59Z")).toBe("2026-10-08");
    expect(spDay("2026-10-09T03:00:00Z")).toBe("2026-10-09");
  });

  it("loads stored lines from ten days before the selected day", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    from.mockReturnValue(query);
    await bankReconciliationService.loadLines("account-1", "2026-10-09");
    expect(query.eq).toHaveBeenCalledWith("account_id", "account-1");
    expect(query.gte).toHaveBeenCalledWith("entry_date", "2026-09-29");
    expect(addDays("2026-10-09", -10)).toBe("2026-09-29");
  });

  it("persists each hash within its company and account without duplicating it", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ upsert });
    await bankReconciliationService.saveLines("company-1", "account-1", [{
      line_hash: "hash-1", entry_date: "2026-10-09", direction: "in", amount: 10,
      description: "Recebimento", counterparty: "Cliente", status: "matched",
    }]);
    expect(upsert).toHaveBeenCalledWith([
      expect.objectContaining({ company_id: "company-1", account_id: "account-1", line_hash: "hash-1" }),
    ], { onConflict: "account_id,line_hash" });
  });
});