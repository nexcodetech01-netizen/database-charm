import { describe, it, expect } from "vitest";
import { selectBlockingIssues } from "../selectors";
import { MonthlyClosingAudit } from "../types";

describe("Monthly Closing Module", () => {
  const mockAudit: MonthlyClosingAudit = {
    month: "2026-07",
    healthScore: { score: 50, level: "Atenção", label: "Teste" },
    checklist: [
      { id: "1", title: "Erro Fiscal", status: "error", domain: "fiscal" },
      { id: "2", title: "Aviso Estoque", status: "warning", domain: "inventory" }
    ],
    summary: {
      monthSummary: "",
      achievements: [],
      problems: [],
      biggestRisk: "",
      biggestOpportunity: "",
      finalRecommendation: ""
    },
    timeline: []
  };

  it("should select blocking issues correctly", () => {
    const blocking = selectBlockingIssues(mockAudit);
    expect(blocking).toHaveLength(1);
    expect(blocking[0].title).toBe("Erro Fiscal");
  });
});
