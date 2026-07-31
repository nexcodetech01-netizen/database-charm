/**
 * Bella Contadora — política de pró-labore e reserva (parâmetros explícitos).
 *
 * Sugestão indicativa, derivada de valores já apurados. Não grava nada,
 * não altera o Financeiro e não substitui a decisão do contador.
 */
import type { AccountingPeriod, PayrollSuggestion } from "../types";
import { clamp } from "./helpers";

export const PAYROLL_POLICY = {
  /** Percentual sugerido do lucro líquido destinado ao pró-labore. */
  payrollRate: 0.3,
  /** Percentual sugerido do lucro líquido destinado à reserva financeira. */
  reserveRate: 0.2,
} as const;

export function suggestPayroll(
  period: AccountingPeriod,
  netProfit: number,
  policy = PAYROLL_POLICY,
): PayrollSuggestion {
  const basis = Math.max(0, netProfit);
  const suggestedAmount = basis * policy.payrollRate;
  const reserveAmount = basis * policy.reserveRate;
  return {
    period,
    basis,
    suggestedAmount,
    suggestedRate: clamp(policy.payrollRate * 100, 0, 100),
    reserveAmount,
    reserveRate: clamp(policy.reserveRate * 100, 0, 100),
    distributableProfit: Math.max(0, basis - suggestedAmount - reserveAmount),
    confident: netProfit > 0,
    rationale:
      netProfit > 0
        ? "Sugestão calculada sobre o lucro líquido apurado no período."
        : "Sem lucro líquido no período — retirada não recomendada.",
  };
}
