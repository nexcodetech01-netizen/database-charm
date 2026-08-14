/**
 * emitProlaboreWithdrawal — ação nova (2026-08-14): a Bella Contadora
 * antes só CONSULTAVA/SIMULAVA o pró-labore (payroll-skills.ts, ambas
 * readOnly). Esta é a primeira ação que de fato registra a retirada
 * como uma saída financeira paga — sempre via createAndSettleTransaction
 * (o motor único já usado em todo o resto do sistema), nunca inserindo
 * "paga" diretamente.
 */
import { describe, it, expect, vi } from "vitest";
import type {
  CashProjection,
  CashSnapshot,
  FinancialHealth,
  PayrollSuggestion,
  ProviderResult,
  TaxSummary,
} from "../../types";

const cash: CashSnapshot = {
  currentBalance: 50000,
  receivable: 20000,
  receivableOverdue: 1000,
  payable: 10000,
  projected: 60000,
  openSessions: 1,
};
const taxes: TaxSummary = {
  competence: "2026-01",
  revenue: 100000,
  taxAmount: 6000,
  effectiveRate: 6,
  status: "open",
  dueDate: "2026-02-20",
};
const cashFlow: CashProjection = {
  horizonDays: 30,
  incoming: 40000,
  outgoing: 20000,
  net: 20000,
  projectedBalance: 70000,
  monthly: [],
};
const payroll: PayrollSuggestion = {
  period: { start: "2026-01-01", end: "2026-01-31" },
  basis: 30000,
  suggestedAmount: 9000,
  suggestedRate: 30,
  reserveAmount: 6000,
  reserveRate: 20,
  distributableProfit: 15000,
  confident: true,
  rationale: "30% do lucro apurado.",
};
const health: FinancialHealth = { level: "healthy", score: 80, factors: [] } as any;

function wrap<T>(data: T): ProviderResult<T> {
  return { available: true, data, source: "accounting", generatedAt: "2026-01-01T00:00:00Z" };
}

const fakeSummary = {
  companyId: "c1",
  period: { start: "2026-01-01", end: "2026-01-31" },
  generatedAt: "2026-01-01T00:00:00Z",
  cash: wrap(cash),
  cashFlow: wrap(cashFlow),
  taxes: wrap(taxes),
  payroll: wrap(payroll),
  health: wrap({ financial: health, operational: null } as any),
} as any;

const createAndSettleTransaction = vi.fn().mockResolvedValue({ id: "tx-1" });

vi.mock("@/features/finance/services/finance.service", () => ({
  financeService: {
    createAndSettleTransaction: (...args: unknown[]) => createAndSettleTransaction(...args),
  },
}));

import { emitProlaboreWithdrawal } from "../actions";

describe("emitProlaboreWithdrawal", () => {
  it("usa o valor seguro recomendado quando nenhum valor é informado", async () => {
    createAndSettleTransaction.mockClear();
    const result = await emitProlaboreWithdrawal(
      { companyId: "c1", accountId: "acc-1" },
      { summary: fakeSummary },
    );
    expect(result.ok).toBe(true);
    expect(result.amount).toBe(result.safeAmount);
    expect(result.exceededSafeAmount).toBe(false);
    expect(createAndSettleTransaction).toHaveBeenCalledTimes(1);
    const [input, settle] = createAndSettleTransaction.mock.calls[0];
    expect(input.type).toBe("expense");
    expect(input.source).toBe("manual"); // nunca um valor fora da constraint do banco
    expect(input.company_id).toBe("c1");
    expect(settle.accountId).toBe("acc-1");
  });

  it("avisa quando o valor pedido ultrapassa o teto seguro, mas ainda registra", async () => {
    createAndSettleTransaction.mockClear();
    const result = await emitProlaboreWithdrawal(
      { companyId: "c1", accountId: "acc-1", amount: 999999 },
      { summary: fakeSummary },
    );
    expect(result.ok).toBe(true);
    expect(result.exceededSafeAmount).toBe(true);
    expect(result.message).toMatch(/passa|ultrapassa|Atenção/i);
    expect(createAndSettleTransaction).toHaveBeenCalledTimes(1);
  });

  it("rejeita valor zero ou negativo sem chamar o motor financeiro", async () => {
    createAndSettleTransaction.mockClear();
    const result = await emitProlaboreWithdrawal(
      { companyId: "c1", accountId: "acc-1", amount: 0 },
      { summary: fakeSummary },
    );
    expect(result.ok).toBe(false);
    expect(createAndSettleTransaction).not.toHaveBeenCalled();
  });

  it("não registra nada quando não há dados suficientes para calcular a retirada", async () => {
    createAndSettleTransaction.mockClear();
    const emptySummary = {
      ...fakeSummary,
      cash: { available: false, data: null, source: "accounting", generatedAt: "2026-01-01T00:00:00Z" },
      payroll: { available: false, data: null, source: "accounting", generatedAt: "2026-01-01T00:00:00Z" },
    };
    const result = await emitProlaboreWithdrawal(
      { companyId: "c1", accountId: "acc-1" },
      { summary: emptySummary },
    );
    expect(result.ok).toBe(false);
    expect(createAndSettleTransaction).not.toHaveBeenCalled();
  });
});
