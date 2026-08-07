import { describe, it, expect } from "vitest";
import { buildFinancialAdvice } from "../advisor/engine";
import { advisorQueries } from "../advisor/queries";
import type { AdvisorInput } from "../advisor/types";

describe("Sprint 8.2 — Distribuição de Lucros", () => {
  const mockInput: AdvisorInput = {
    summary: {
      cash: { data: { currentBalance: 50000, payable: 10000, receivable: 5000 } },
      cashFlow: { data: { outgoing: 20000 } },
      taxes: { data: { taxAmount: 5000 } },
      payroll: { data: { suggestedAmount: 6000, suggestedRate: 30, reserveAmount: 4000 } },
      health: { data: { financial: { score: 80, level: "healthy" } } },
    } as any
  };

  it("Dashboard: deve calcular valores corretos via motor oficial", () => {
    const advice = buildFinancialAdvice(mockInput);
    
    // Commitments = 10000 (payable) + 5000 (taxes) = 15000
    expect(advice.commitments.total).toBe(15000);
    
    // Reserve = max(4000 (payroll), 20000 * 0.5 (operational)) = 10000
    expect(advice.reserve.recommended).toBe(10000);
    
    // safeAmount = 50000 - 15000 - 10000 = 25000
    expect(advice.withdrawal.safeAmount).toBe(25000);
  });

  it("Chat: deve responder sobre disponibilidade", () => {
    const advice = buildFinancialAdvice(mockInput);
    const query = advisorQueries.quantoPossoDistribuir(advice);
    expect(query.value).toBe(25000);
    expect(query.text).toContain("25.000,00");
  });

  it("Simulação: deve identificar risco em retiradas excessivas", () => {
    // Retirada de 40.000 quando o seguro é 25.000
    const advice = buildFinancialAdvice({ ...mockInput, requestedAmount: 40000 });
    expect(advice.withdrawal.approved).toBe(false);
    expect(advice.risk.level).toBe("high");
  });
});
