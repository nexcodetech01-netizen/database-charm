import { describe, expect, it, vi } from "vitest";
import { financeService } from "../finance.service";

function clientWith(rpcResult: { data: unknown; error: unknown }) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) } as never;
}

describe("financeService.overview (soma no banco)", () => {
  it("monta os indicadores a partir da RPC finance_overview", async () => {
    const overview = await financeService.overview(
      "c1",
      clientWith({
        data: {
          current_balance: 1000,
          receivable: 90,
          receivable_overdue: 40,
          receivable_due30: 30,
          receivable_due60_plus: 20,
          payable: 70,
          gross_revenue: 1500,
          month_expense: 10,
          taxes_and_deductions: 10,
          receipts_today: 1500,
          receipts_today_count: 1500,
          pending_receivable: 70,
          pending_receivable_count: 2,
          upcoming_income: [{ id: "a", description: "vencido", date: "2026-09-30", amount: 40 }],
          upcoming_expense: [],
        },
        error: null,
      }),
    );
    expect(overview.currentBalance).toBe(1000);
    expect(overview.projected).toBe(1000 + 90 - 70);
    expect(overview.receiptsTodayCount).toBe(1500); // mais que o limite de 1.000 linhas da API
    expect(overview.monthProfit).toBe(1490);
    expect(overview.upcomingIncome[0]).toEqual({
      id: "a",
      description: "vencido",
      date: "2026-09-30",
      amount: 40,
    });
  });

  it("repassa erro real do banco (não esconde)", async () => {
    await expect(
      financeService.overview("c1", clientWith({ data: null, error: { code: "42501", message: "Acesso negado" } })),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
