import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const order = vi.fn();
const eq = vi.fn(() => ({ order }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn((_table: string) => ({ select }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, params: unknown) => rpc(name, params),
    from: (table: string) => from(table),
  },
}));

const { accountingService } = await import("../accounting.service");

const dreRow = {
  period: { start: "2026-07-01", end: "2026-07-31" },
  gross_revenue: "1000",
  deductions: 100,
  net_revenue: 900,
  cogs: 400,
  gross_profit: 500,
  operating_expenses: 200,
  operating_result: 300,
  financial_expenses: 50,
  other_revenues: 0,
  other_expenses: 0,
  result_before_taxes: 250,
  net_profit: 250,
  depreciation: 20,
  ebitda: 320,
  gross_margin: 55.56,
  operating_margin: 33.33,
  net_margin: 27.78,
  ebitda_margin: 35.56,
  lines: [{ code: "4.1.01", name: "Receita de Vendas", type: "RECEITA", amount: "1000" }],
};

beforeEach(() => {
  rpc.mockReset();
  order.mockReset();
  from.mockClear();
});

describe("accountingService", () => {
  it("mapeia o plano de contas", async () => {
    order.mockResolvedValue({
      data: [
        {
          id: "a1",
          company_id: "c1",
          code: "1.1.01",
          name: "Caixa",
          type: "ATIVO",
          nature: "debit",
          parent_id: "a0",
          accepts_posting: true,
          is_depreciation: false,
          active: true,
        },
      ],
      error: null,
    });
    const accounts = await accountingService.chartOfAccounts("c1");
    expect(accounts[0]).toMatchObject({ code: "1.1.01", acceptsPosting: true, parentId: "a0" });
  });

  it("propaga erro do plano de contas", async () => {
    order.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(accountingService.chartOfAccounts("c1")).rejects.toThrow("boom");
  });

  it("mapeia o DRE", async () => {
    rpc.mockResolvedValue({ data: dreRow, error: null });
    const dre = await accountingService.dre("c1", "2026-07-01", "2026-07-31");
    expect(dre.grossRevenue).toBe(1000);
    expect(dre.ebitda).toBe(320);
    expect(dre.lines[0]).toEqual({
      code: "4.1.01",
      name: "Receita de Vendas",
      type: "RECEITA",
      amount: 1000,
    });
  });

  it("propaga erro do DRE", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("dre") });
    await expect(accountingService.dre("c1", "a", "b")).rejects.toThrow("dre");
  });

  it("mapeia o balanço", async () => {
    rpc.mockResolvedValue({
      data: {
        as_of: "2026-07-31",
        assets: 1000,
        liabilities: 400,
        equity: 600,
        equity_capital: 350,
        period_result: 250,
        balanced: true,
        difference: 0,
        lines: null,
      },
      error: null,
    });
    const bs = await accountingService.balanceSheet("c1", "2026-07-31");
    expect(bs.balanced).toBe(true);
    expect(bs.equity).toBe(600);
    expect(bs.lines).toEqual([]);
  });

  it("propaga erro do balanço", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("bs") });
    await expect(accountingService.balanceSheet("c1", "x")).rejects.toThrow("bs");
  });

  it("mapeia os KPIs, inclusive liquidez nula", async () => {
    rpc.mockResolvedValue({
      data: {
        period: { start: "2026-07-01", end: "2026-07-31" },
        current_liquidity: null,
        working_capital: 100,
        debt_ratio: 40,
        gross_margin: 55.56,
        operating_margin: 33.33,
        net_margin: 27.78,
        ebitda: 320,
        ebitda_margin: 35.56,
        roi: 25,
        roe: 41.6,
        average_ticket: 150,
        sales_count: 6,
        cogs_ratio: 44.4,
        expense_ratio: 22.2,
        break_even: 400,
      },
      error: null,
    });
    const kpis = await accountingService.kpis("c1", "2026-07-01", "2026-07-31");
    expect(kpis.currentLiquidity).toBeNull();
    expect(kpis.salesCount).toBe(6);
  });

  it("usa valores padrão quando a RPC devolve vazio", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const kpis = await accountingService.kpis("c1", "a", "b");
    expect(kpis.workingCapital).toBe(0);
    expect(kpis.currentLiquidity).toBeNull();
  });

  it("propaga erro dos KPIs", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("kpi") });
    await expect(accountingService.kpis("c1", "a", "b")).rejects.toThrow("kpi");
  });

  it("tolera plano de contas vazio", async () => {
    order.mockResolvedValue({ data: null, error: null });
    await expect(accountingService.chartOfAccounts("c1")).resolves.toEqual([]);
  });

  it("tolera DRE sem período e com linhas incompletas", async () => {
    rpc.mockResolvedValue({ data: { lines: [{}] }, error: null });
    const dre = await accountingService.dre("c1", "a", "b");
    expect(dre.period).toEqual({ start: "", end: "" });
    expect(dre.netRevenue).toBe(0);
    expect(dre.lines[0]).toMatchObject({ code: "", name: "", amount: 0 });
  });

  it("tolera balanço vazio", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const bs = await accountingService.balanceSheet("c1", "x");
    expect(bs).toMatchObject({ asOf: "", assets: 0, balanced: false, lines: [] });
  });

  it("monta a evolução mensal a partir do DRE", async () => {
    rpc.mockResolvedValue({ data: dreRow, error: null });
    const evo = await accountingService.monthlyEvolution("c1", [
      { start: "2026-06-01", end: "2026-06-30", label: "06/2026" },
      { start: "2026-07-01", end: "2026-07-31", label: "07/2026" },
    ]);
    expect(evo).toHaveLength(2);
    expect(evo[1].label).toBe("07/2026");
    expect(evo[0].dre.netProfit).toBe(250);
  });
});
