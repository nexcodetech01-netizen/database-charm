import { describe, expect, it } from "vitest";
import {
  ADVISOR_POLICY,
  advisorQueries,
  buildFinancialAdvice,
  commitments,
  INSUFFICIENT_DATA_MESSAGE,
  reserveAmount,
  riskLevel,
  safeWithdrawal,
} from "../advisor";
import type {
  CashProjection,
  CashSnapshot,
  FinancialHealth,
  PayrollSuggestion,
  TaxSummary,
} from "../types";

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

const health: FinancialHealth = {
  level: "healthy",
  score: 85,
  liquidity: 1.8,
  workingCapital: 20000,
  debtRatio: 30,
  reasons: [],
};

const baseInput = { cash, taxes, cashFlow, payroll, health };

describe("advisor · helpers", () => {
  it("soma compromissos como a pagar + impostos", () => {
    const c = commitments(cash, taxes, cashFlow);
    expect(c).toEqual({ payable: 10000, taxes: 6000, projectedOutgoing: 20000, total: 16000 });
  });

  it("usa a maior reserva entre política de lucro e operacional", () => {
    const r = reserveAmount(payroll, cashFlow);
    expect(r.fromPayroll).toBe(6000);
    expect(r.operational).toBe(20000 * ADVISOR_POLICY.operationalReserveRate);
    expect(r.recommended).toBe(10000);
  });

  it("nunca devolve retirada segura negativa", () => {
    expect(safeWithdrawal(1000, 5000, 2000)).toBe(0);
  });

  it("classifica risco crítico quando não há caixa", () => {
    expect(riskLevel(null, 0, 0).level).toBe("critical");
  });

  it("classifica risco alto quando pedido excede o teto seguro", () => {
    expect(riskLevel(30000, 10000, 50000).level).toBe("high");
  });

  it("classifica risco baixo dentro do teto e com folga", () => {
    expect(riskLevel(5000, 24000, 50000).level).toBe("low");
  });

  it("eleva o risco quando a saúde financeira é crítica", () => {
    const r = riskLevel(5000, 24000, 50000, { ...health, level: "critical" });
    expect(r.level).toBe("high");
  });
});

describe("advisor · engine", () => {
  it("apura caixa, compromissos, reserva e retirada segura", () => {
    const advice = buildFinancialAdvice(baseInput);
    expect(advice.available).toBe(true);
    expect(advice.availableCash).toBe(50000);
    expect(advice.commitments.total).toBe(16000);
    expect(advice.reserve.recommended).toBe(10000);
    expect(advice.withdrawal.rawAmount).toBe(34000);
    expect(advice.withdrawal.safeAmount).toBe(24000);
  });

  it("aprova retirada dentro do teto seguro", () => {
    const advice = buildFinancialAdvice({ ...baseInput, requestedAmount: 10000 });
    expect(advice.withdrawal.recommendation).toBe("approved");
    expect(advice.withdrawal.approved).toBe(true);
  });

  it("recomenda parcialmente quando o pedido excede o teto", () => {
    const advice = buildFinancialAdvice({ ...baseInput, requestedAmount: 40000 });
    expect(advice.withdrawal.recommendation).toBe("partial");
    expect(advice.withdrawal.approved).toBe(false);
    expect(advice.risk.level).toBe("high");
  });

  it("rejeita quando não há folga alguma", () => {
    const advice = buildFinancialAdvice({
      ...baseInput,
      cash: { ...cash, currentBalance: 12000 },
      requestedAmount: 5000,
    });
    expect(advice.withdrawal.safeAmount).toBe(0);
    expect(advice.withdrawal.recommendation).toBe("rejected");
  });

  it("é determinístico para a mesma entrada", () => {
    const a = buildFinancialAdvice(baseInput);
    const b = buildFinancialAdvice(baseInput);
    expect({ ...a, generatedAt: "" }).toEqual({ ...b, generatedAt: "" });
  });

  it("não estima nada quando falta o caixa", () => {
    const advice = buildFinancialAdvice({ ...baseInput, cash: null });
    expect(advice.available).toBe(false);
    expect(advice.message).toBe(INSUFFICIENT_DATA_MESSAGE);
    expect(advice.missing).toContain("caixa");
  });
});

describe("advisor · consultas", () => {
  const advice = buildFinancialAdvice(baseInput);

  it("responde quanto pode ser retirado", () => {
    const a = advisorQueries.quantoPossoRetirar(advice);
    expect(a.value).toBe(24000);
    expect(a.text).toContain("24.000");
  });

  it("responde posso retirar com motivos", () => {
    const a = advisorQueries.possoRetirar(
      buildFinancialAdvice({ ...baseInput, requestedAmount: 5000 }),
      5000,
    );
    expect(a.text).toContain("Recomendado.");
    expect(a.text).toContain("Motivos:");
  });

  it("responde reserva, disponível, comprometido, pagar, receber e impostos", () => {
    expect(advisorQueries.quantoManterDeReserva(advice).value).toBe(10000);
    expect(advisorQueries.quantoDisponivel(advice).value).toBe(50000);
    expect(advisorQueries.quantoComprometido(advice).value).toBe(16000);
    expect(advisorQueries.quantoPrecisoPagar(advice).value).toBe(10000);
    expect(advisorQueries.quantoDevoReceber(advice, cash).value).toBe(20000);
    expect(advisorQueries.reservaParaImpostos(advice).value).toBe(6000);
  });

  it("devolve a mensagem padrão sem dados", () => {
    const none = buildFinancialAdvice({ cash: null });
    expect(advisorQueries.quantoPossoRetirar(none).text).toBe(INSUFFICIENT_DATA_MESSAGE);
    expect(advisorQueries.quantoDisponivel(none).available).toBe(false);
  });
});
