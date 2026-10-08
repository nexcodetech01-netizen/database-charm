import { describe, expect, it } from "vitest";
import { hasAnythingDue } from "../daily-finance-summary-dialog";

describe("resumo financeiro do dia", () => {
  it("só abre quando há algo vencido, de hoje ou dos próximos 7 dias", () => {
    expect(hasAnythingDue({ cells: {} })).toBe(false);
    expect(hasAnythingDue(null)).toBe(false);
    expect(hasAnythingDue({ cells: { income_overdue: { total: 106.53, count: 2 } } })).toBe(true);
    expect(hasAnythingDue({ cells: { expense_today: { total: 0, count: 0 } } })).toBe(false);
  });
});
