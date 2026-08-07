import { describe, it, expect } from "vitest";
import { selectBlockingIssues } from "../selectors";
import { MonthlyClosingAudit } from "../types";

import { consolidateMonthlyAudit } from "../queries/executive-consolidation";

describe("Monthly Closing Module - Executive Consolidation", () => {
  const createMockAudit = (domain: any, score: number): MonthlyClosingAudit => ({
    month: "2026-07",
    healthScore: { score, level: "Boa", label: `${domain} Test` },
    checklist: [{ id: `${domain}_1`, title: `${domain} Issue`, status: score < 50 ? "error" : "success", domain }],
    summary: {
      monthSummary: `${domain} Summary`,
      achievements: [`${domain} OK`],
      problems: score < 50 ? [`${domain} Error`] : [],
      biggestRisk: `${domain} Risk`,
      biggestOpportunity: `${domain} Opportunity`,
      finalRecommendation: `${domain} Rec`
    },
    timeline: [{ date: new Date().toISOString(), domain, event: `${domain} Event`, type: "info" }]
  });

  const audits = {
    finance: createMockAudit("finance", 80),
    fiscal: createMockAudit("fiscal", 70),
    inventory: createMockAudit("inventory", 60),
    purchases: createMockAudit("purchases", 90),
    sales: createMockAudit("sales", 40),
    cash: createMockAudit("pos", 100)
  };

  it("should consolidate scores as an average", () => {
    const consolidated = consolidateMonthlyAudit(audits, "2026-07");
    // (80+70+60+90+40+100) / 6 = 440 / 6 = 73.33 -> 73
    expect(consolidated.healthScore.score).toBe(73);
  });

  it("should unify all checklists and timelines", () => {
    const consolidated = consolidateMonthlyAudit(audits, "2026-07");
    expect(consolidated.checklist).toHaveLength(6);
    expect(consolidated.timeline).toHaveLength(6);
  });

  it("should pick biggest risk from the weakest domain", () => {
    const consolidated = consolidateMonthlyAudit(audits, "2026-07");
    // Sales is the weakest (40)
    expect(consolidated.summary.biggestRisk).toBe("sales Risk");
  });

  it("should select blocking issues correctly", () => {
    const consolidated = consolidateMonthlyAudit(audits, "2026-07");
    const blocking = selectBlockingIssues(consolidated);
    expect(blocking).toHaveLength(1);
    expect(blocking[0].domain).toBe("sales");
  });
});
