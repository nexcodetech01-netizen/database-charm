/**
 * Bella Contadora — Consultas de Pró-Labore (Sprint 8.1).
 */
import { formatCurrency } from "@/lib/format";
import type { AccountingSummary } from "../../types";
import type { FinancialAdvice } from "../../advisor/types";

export type PayrollQueryId =
  | "prolabore_sugerido"
  | "reserva_sugerida"
  | "lucro_distribuivel"
  | "risco_retirada";

export interface PayrollQueryAnswer {
  id: PayrollQueryId;
  label: string;
  available: boolean;
  value: number | null;
  text: string;
}

function answer(
  id: PayrollQueryId,
  label: string,
  value: number | null,
  text: string,
): PayrollQueryAnswer {
  return { id, label, available: value !== null, value, text };
}

function missing(id: PayrollQueryId, label: string): PayrollQueryAnswer {
  return { id, label, available: false, value: null, text: `${label}: Sem dados no período.` };
}

export const payrollQueries = {
  prolaboreSugerido(advice: FinancialAdvice): PayrollQueryAnswer {
    if (!advice.payroll.available) return missing("prolabore_sugerido", "Pró-labore sugerido");
    return answer(
      "prolabore_sugerido",
      "Pró-labore sugerido",
      advice.payroll.suggestedAmount,
      `Pró-labore sugerido: ${formatCurrency(advice.payroll.suggestedAmount)} (${advice.payroll.suggestedRate.toFixed(0)}% do lucro).`,
    );
  },

  reservaSugerida(advice: FinancialAdvice): PayrollQueryAnswer {
    if (!advice.reserve.available) return missing("reserva_sugerida", "Reserva financeira");
    return answer(
      "reserva_sugerida",
      "Reserva financeira",
      advice.reserve.recommended,
      `Reserva sugerida: ${formatCurrency(advice.reserve.recommended)}.`,
    );
  },

  lucroDistribuivel(s: AccountingSummary): PayrollQueryAnswer {
    const payroll = s.payroll.data;
    if (!payroll) return missing("lucro_distribuivel", "Lucro distribuível");
    return answer(
      "lucro_distribuivel",
      "Lucro distribuível",
      payroll.distributableProfit,
      `Lucro distribuível estimado: ${formatCurrency(payroll.distributableProfit)}.`,
    );
  },

  riscoRetirada(advice: FinancialAdvice): PayrollQueryAnswer {
    if (!advice.available) return missing("risco_retirada", "Risco");
    return answer(
      "risco_retirada",
      "Risco",
      advice.risk.score,
      `Nível de risco: ${advice.risk.label} (${advice.risk.score}/100).`,
    );
  },
};
