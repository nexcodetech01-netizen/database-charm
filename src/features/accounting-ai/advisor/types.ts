/**
 * Bella Contadora — Advisor (Sprint 5.3): contratos da consultoria financeira.
 *
 * Nenhuma regra financeira nova é criada aqui: o Advisor apenas interpreta
 * valores já apurados pelos motores existentes (Contábil, Financeiro,
 * Fiscal, Caixa) e devolve uma recomendação determinística.
 */
import type {
  AccountingSummary,
  CashProjection,
  CashSnapshot,
  FinancialHealth,
  PayrollSuggestion,
  TaxSummary,
} from "../types";

/** Nível de risco de uma retirada. */
export type CashRiskLevel = "low" | "medium" | "high" | "critical" | "unknown";

export interface CashRisk {
  level: CashRiskLevel;
  label: string;
  /** 0-100 — quanto maior, maior o risco. */
  score: number;
  reasons: string[];
}

/** Compromissos já assumidos (a pagar + impostos previstos). */
export interface Commitments {
  payable: number;
  taxes: number;
  projectedOutgoing: number;
  total: number;
}

export interface ReserveAnalysis {
  available: boolean;
  /** Reserva recomendada em R$. */
  recommended: number;
  /** Reserva vinda da política de pró-labore (lucro do período). */
  fromPayroll: number;
  /** Reserva mínima operacional derivada das saídas previstas. */
  operational: number;
  rationale: string;
}

export interface WithdrawalAnalysis {
  available: boolean;
  /** Valor solicitado pelo usuário (quando houver). */
  requested: number | null;
  /** Teto seguro apurado hoje. */
  safeAmount: number;
  /** Sobra bruta antes de aplicar o teto de pró-labore. */
  rawAmount: number;
  approved: boolean;
  recommendation: "approved" | "partial" | "rejected" | "unknown";
  reasons: string[];
}

export interface PayrollAnalysis {
  available: boolean;
  suggestedAmount: number;
  suggestedRate: number;
  basis: number;
  confident: boolean;
  rationale: string;
}

export interface FinancialAdvice {
  generatedAt: string;
  /** `false` quando faltam dados — nunca estimamos. */
  available: boolean;
  availableCash: number;
  commitments: Commitments;
  reserve: ReserveAnalysis;
  withdrawal: WithdrawalAnalysis;
  payroll: PayrollAnalysis;
  risk: CashRisk;
  /** Texto determinístico pronto para exibição/skill. */
  message: string;
  missing: string[];
}

/** Entrada do Advisor Engine — apenas dados já apurados. */
export interface AdvisorInput {
  summary?: AccountingSummary | null;
  cash?: CashSnapshot | null;
  cashFlow?: CashProjection | null;
  taxes?: TaxSummary | null;
  payroll?: PayrollSuggestion | null;
  health?: FinancialHealth | null;
  /** Valor que o usuário deseja retirar (opcional). */
  requestedAmount?: number | null;
}
