import { describe, it, expect } from "vitest";
import { auditCashClosing } from "../queries/cash-audit";
import { makeSummary } from "../../tests/fixtures";
import { AuditCashSessionRow } from "../../services/ports";

describe("auditCashClosing", () => {
  it("should detect open sessions as an error", async () => {
    const summary = await makeSummary();
    const month = "2024-03";
    const sessions: AuditCashSessionRow[] = [
      { id: "1", status: "open", openedAt: "2024-03-01T08:00:00Z", closedAt: null, expectedCash: 100, countedCash: null, difference: null }
    ];
    
    const result = auditCashClosing(summary, sessions, month);
    
    const openCheck = result.checklist.find(i => i.id === "cash_open");
    expect(openCheck).toBeDefined();
    expect(openCheck?.status).toBe("error");
    expect(result.healthScore.score).toBeLessThan(100);
  });

  it("should detect significant cash differences", async () => {
    const summary = await makeSummary();
    const month = "2024-03";
    const sessions: AuditCashSessionRow[] = [
      { id: "1", status: "closed", openedAt: "2024-03-01T08:00:00Z", closedAt: "2024-03-01T18:00:00Z", expectedCash: 100, countedCash: 80, difference: -20 }
    ];
    
    const result = auditCashClosing(summary, sessions, month);
    
    const diffCheck = result.checklist.find(i => i.id === "cash_diff");
    expect(diffCheck).toBeDefined();
    expect(diffCheck?.status).toBe("warning");
  });

  it("should give high score for perfect reconciliation", async () => {
    const summary = await makeSummary();
    const month = "2024-03";
    const sessions: AuditCashSessionRow[] = [
      { id: "1", status: "closed", openedAt: "2024-03-01T08:00:00Z", closedAt: "2024-03-01T18:00:00Z", expectedCash: 100, countedCash: 100, difference: 0 }
    ];
    
    const result = auditCashClosing(summary, sessions, month);
    
    expect(result.healthScore.score).toBe(100);
    expect(result.healthScore.level).toBe("Exelente");
    expect(result.checklist.length).toBe(0);
  });

  it("should handle empty period gracefully", async () => {
    const summary = await makeSummary();
    const month = "2024-03";
    const result = auditCashClosing(summary, [], month);
    expect(result.healthScore.score).toBe(50);
  });
});
