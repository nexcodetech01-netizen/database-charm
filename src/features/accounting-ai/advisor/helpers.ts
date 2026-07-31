/**
 * Bella Contadora — helpers puros do Advisor.
 *
 * 100% determinísticos: sem React, sem Supabase, sem IO, sem efeitos.
 * Todos recebem valores já apurados pelos motores existentes.
 */
import type {
  CashProjection,
  CashSnapshot,
  FinancialHealth,
  PayrollSuggestion,
  TaxSummary,
} from "../types";
import type { CashRisk, CashRiskLevel, Commitments } from "./types";

/**
 * Política do Advisor (parâmetros explícitos e auditáveis).
 * Não substitui nem recalcula nenhuma regra do Financeiro/Fiscal.
 */
export const ADVISOR_POLICY = {
  /** Parcela das saídas previstas (30 dias) mantida como reserva mínima. */
  operationalReserveRate: 0.5,
  /** Acima deste percentual do caixa disponível, a retirada vira risco alto. */
  highRiskUsage: 0.7,
  /** A partir deste percentual, risco crítico. */
  criticalRiskUsage: 1,
  /** Até este percentual, risco baixo. */
  lowRiskUsage: 0.3,
} as const;

export const RISK_LABELS: Record<CashRiskLevel, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico",
  unknown: "Sem dados",
};

export const round2 = (v: number) => Math.round(v * 100) / 100;

/** Caixa disponível hoje — nunca estimado. */
export function availableCash(cash: CashSnapshot | null | undefined): number | null {
  if (!cash) return null;
  return round2(cash.currentBalance);
}

/** Compromissos assumidos: contas a pagar + impostos previstos. */
export function commitments(
  cash: CashSnapshot | null | undefined,
  taxes: TaxSummary | null | undefined,
  cashFlow?: CashProjection | null,
): Commitments | null {
  if (!cash) return null;
  const payable = Math.max(0, cash.payable);
  const tax = Math.max(0, taxes?.taxAmount ?? 0);
  const projectedOutgoing = Math.max(0, cashFlow?.outgoing ?? 0);
  return {
    payable: round2(payable),
    taxes: round2(tax),
    projectedOutgoing: round2(projectedOutgoing),
    total: round2(payable + tax),
  };
}

/**
 * Reserva recomendada: o maior valor entre a reserva sugerida pela política
 * de pró-labore (sobre o lucro apurado) e a reserva operacional derivada
 * das saídas previstas.
 */
export function reserveAmount(
  payroll: PayrollSuggestion | null | undefined,
  cashFlow?: CashProjection | null,
  policy = ADVISOR_POLICY,
): { recommended: number; fromPayroll: number; operational: number } {
  const fromPayroll = Math.max(0, payroll?.reserveAmount ?? 0);
  const operational = Math.max(0, (cashFlow?.outgoing ?? 0) * policy.operationalReserveRate);
  return {
    recommended: round2(Math.max(fromPayroll, operational)),
    fromPayroll: round2(fromPayroll),
    operational: round2(operational),
  };
}

/**
 * Teto seguro de retirada: caixa disponível − compromissos − reserva.
 * Nunca negativo.
 */
export function safeWithdrawal(
  available: number,
  totalCommitments: number,
  reserve: number,
): number {
  return round2(Math.max(0, available - totalCommitments - reserve));
}

/** Nível de risco da retirada, considerando a saúde financeira apurada. */
export function riskLevel(
  requested: number | null,
  safeAmount: number,
  available: number,
  health?: FinancialHealth | null,
  policy = ADVISOR_POLICY,
): CashRisk {
  if (available <= 0) {
    return {
      level: "critical",
      label: RISK_LABELS.critical,
      score: 95,
      reasons: ["Caixa disponível zerado ou negativo."],
    };
  }

  const reasons: string[] = [];
  const amount = requested ?? safeAmount;
  const usage = amount / available;

  let level: CashRiskLevel;
  if (requested !== null && requested > safeAmount) {
    level = usage >= policy.criticalRiskUsage ? "critical" : "high";
    reasons.push("Valor solicitado acima do teto seguro apurado.");
  } else if (usage >= policy.highRiskUsage) {
    level = "high";
    reasons.push("Retirada compromete mais de 70% do caixa disponível.");
  } else if (usage > policy.lowRiskUsage) {
    level = "medium";
    reasons.push("Retirada compromete parte relevante do caixa disponível.");
  } else {
    level = "low";
    reasons.push("Retirada dentro do teto seguro e com folga de caixa.");
  }

  if (health?.level === "critical" && level !== "critical") {
    level = "high";
    reasons.push("Saúde financeira classificada como crítica.");
  } else if (health?.level === "attention" && level === "low") {
    level = "medium";
    reasons.push("Saúde financeira em atenção.");
  }

  const scoreByLevel: Record<CashRiskLevel, number> = {
    low: 20,
    medium: 50,
    high: 75,
    critical: 95,
    unknown: 0,
  };

  return { level, label: RISK_LABELS[level], score: scoreByLevel[level], reasons };
}
