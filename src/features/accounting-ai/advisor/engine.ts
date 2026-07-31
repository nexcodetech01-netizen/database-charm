/**
 * Bella Contadora — Advisor Engine (puro).
 *
 * Sem React, sem Supabase, sem IO, sem efeitos colaterais.
 * Recebe apenas dados já apurados (AccountingSummary / FinancialHealth /
 * CashProjection / TaxSummary / PayrollSuggestion) e devolve FinancialAdvice.
 *
 * Quando faltar informação essencial, devolve `available: false` com a
 * mensagem padrão — nunca estima valores.
 */
import { formatCurrency } from "@/lib/format";
import type {
  CashProjection,
  CashSnapshot,
  FinancialHealth,
  PayrollSuggestion,
  TaxSummary,
} from "../types";
import {
  availableCash,
  commitments as buildCommitments,
  reserveAmount,
  riskLevel,
  round2,
  RISK_LABELS,
} from "./helpers";
import type {
  AdvisorInput,
  Commitments,
  FinancialAdvice,
  PayrollAnalysis,
  ReserveAnalysis,
  WithdrawalAnalysis,
} from "./types";

export const INSUFFICIENT_DATA_MESSAGE =
  "Não há dados suficientes para recomendar uma retirada.";

const EMPTY_COMMITMENTS: Commitments = {
  payable: 0,
  taxes: 0,
  projectedOutgoing: 0,
  total: 0,
};

function resolveSources(input: AdvisorInput): {
  cash: CashSnapshot | null;
  cashFlow: CashProjection | null;
  taxes: TaxSummary | null;
  payroll: PayrollSuggestion | null;
  health: FinancialHealth | null;
} {
  const s = input.summary ?? null;
  return {
    cash: input.cash ?? s?.cash.data ?? null,
    cashFlow: input.cashFlow ?? s?.cashFlow.data ?? null,
    taxes: input.taxes ?? s?.taxes.data ?? null,
    payroll: input.payroll ?? s?.payroll.data ?? null,
    health: input.health ?? s?.health.data?.financial ?? null,
  };
}

function payrollAnalysis(payroll: PayrollSuggestion | null): PayrollAnalysis {
  if (!payroll) {
    return {
      available: false,
      suggestedAmount: 0,
      suggestedRate: 0,
      basis: 0,
      confident: false,
      rationale: "Sem lucro apurado no período para sugerir pró-labore.",
    };
  }
  return {
    available: true,
    suggestedAmount: round2(payroll.suggestedAmount),
    suggestedRate: payroll.suggestedRate,
    basis: round2(payroll.basis),
    confident: payroll.confident,
    rationale: payroll.rationale,
  };
}

function unavailableAdvice(missing: string[], requested: number | null): FinancialAdvice {
  return {
    generatedAt: new Date().toISOString(),
    available: false,
    availableCash: 0,
    commitments: EMPTY_COMMITMENTS,
    reserve: {
      available: false,
      recommended: 0,
      fromPayroll: 0,
      operational: 0,
      rationale: INSUFFICIENT_DATA_MESSAGE,
    },
    withdrawal: {
      available: false,
      requested,
      safeAmount: 0,
      rawAmount: 0,
      approved: false,
      recommendation: "unknown",
      reasons: [INSUFFICIENT_DATA_MESSAGE],
    },
    payroll: payrollAnalysis(null),
    risk: { level: "unknown", label: RISK_LABELS.unknown, score: 0, reasons: [] },
    message: INSUFFICIENT_DATA_MESSAGE,
    missing,
  };
}

/** Motor principal — puro e determinístico. */
export function buildFinancialAdvice(input: AdvisorInput): FinancialAdvice {
  const { cash, cashFlow, taxes, payroll, health } = resolveSources(input);
  const requested =
    typeof input.requestedAmount === "number" && Number.isFinite(input.requestedAmount)
      ? round2(Math.max(0, input.requestedAmount))
      : null;

  const missing: string[] = [];
  if (!cash) missing.push("caixa");
  if (!cashFlow) missing.push("fluxo de caixa");
  if (!taxes) missing.push("impostos previstos");
  if (!payroll) missing.push("pró-labore sugerido");
  if (!health) missing.push("saúde financeira");

  const available = availableCash(cash);
  const commitments = buildCommitments(cash, taxes, cashFlow);

  // Sem caixa apurado não há como recomendar nada.
  if (available === null || commitments === null) {
    return unavailableAdvice(missing, requested);
  }

  const reserveParts = reserveAmount(payroll, cashFlow);
  const reserve: ReserveAnalysis = {
    available: true,
    recommended: reserveParts.recommended,
    fromPayroll: reserveParts.fromPayroll,
    operational: reserveParts.operational,
    rationale:
      reserveParts.recommended === 0
        ? "Sem lucro apurado e sem saídas previstas: nenhuma reserva calculável."
        : reserveParts.fromPayroll >= reserveParts.operational
          ? "Reserva derivada do lucro apurado no período."
          : "Reserva derivada das saídas previstas para os próximos dias.",
  };

  const rawAmount = round2(Math.max(0, available - commitments.total));
  const safeAmount = round2(Math.max(0, rawAmount - reserve.recommended));

  const payrollInfo = payrollAnalysis(payroll);
  const risk = riskLevel(requested, safeAmount, available, health);

  const reasons: string[] = [
    `Caixa disponível: ${formatCurrency(available)}.`,
    `Contas a pagar: ${formatCurrency(commitments.payable)}.`,
    `Impostos previstos: ${formatCurrency(commitments.taxes)}.`,
    `Reserva mínima: ${formatCurrency(reserve.recommended)}.`,
  ];
  if (cash?.receivable) {
    reasons.push(`Contas a receber: ${formatCurrency(cash.receivable)}.`);
  }
  if (payrollInfo.available) {
    reasons.push(`Pró-labore sugerido: ${formatCurrency(payrollInfo.suggestedAmount)}.`);
  }
  if (health) {
    reasons.push(`Saúde financeira: ${health.level} (${health.score}/100).`);
  }

  let recommendation: WithdrawalAnalysis["recommendation"];
  if (requested === null) {
    recommendation = safeAmount > 0 ? "approved" : "rejected";
  } else if (requested <= safeAmount) {
    recommendation = "approved";
  } else if (safeAmount > 0) {
    recommendation = "partial";
  } else {
    recommendation = "rejected";
  }

  const withdrawal: WithdrawalAnalysis = {
    available: true,
    requested,
    safeAmount,
    rawAmount,
    approved: recommendation === "approved",
    recommendation,
    reasons,
  };

  const head =
    requested === null
      ? safeAmount > 0
        ? `Valor seguro hoje: ${formatCurrency(safeAmount)}.`
        : "Nenhuma retirada é recomendada hoje."
      : recommendation === "approved"
        ? `Retirada de ${formatCurrency(requested)} recomendada.`
        : recommendation === "partial"
          ? `Retirada de ${formatCurrency(requested)} não recomendada. Valor seguro hoje: ${formatCurrency(safeAmount)}.`
          : `Retirada de ${formatCurrency(requested)} não recomendada. Não há folga de caixa hoje.`;

  const message = `${head} Nível de risco: ${risk.label}.`;

  return {
    generatedAt: new Date().toISOString(),
    available: true,
    availableCash: available,
    commitments,
    reserve,
    withdrawal,
    payroll: payrollInfo,
    risk,
    message,
    missing,
  };
}

/** Atalho: "Posso retirar R$ X?" sobre uma análise já construída. */
export function analyzeWithdrawal(
  input: AdvisorInput,
  requestedAmount: number,
): FinancialAdvice {
  return buildFinancialAdvice({ ...input, requestedAmount });
}
