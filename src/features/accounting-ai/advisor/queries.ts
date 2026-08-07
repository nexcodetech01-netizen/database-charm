/**
 * Bella Contadora — consultas do Advisor (Sprint 5.3).
 *
 * Leituras puras sobre o `FinancialAdvice` já produzido pelo engine.
 * Nenhum valor é estimado: sem dados, a resposta é a mensagem padrão.
 */
import { formatCurrency } from "@/lib/format";
import type { CashSnapshot } from "../types";
import { INSUFFICIENT_DATA_MESSAGE } from "./engine";
import type { FinancialAdvice } from "./types";

export type AdvisorQueryId =
  | "posso_retirar"
  | "quanto_posso_retirar"
  | "quanto_manter_reserva"
  | "quanto_disponivel"
  | "quanto_comprometido"
  | "quanto_pagar"
  | "quanto_receber"
  | "reserva_impostos"
  | "quanto_distribui"
  | "quanto_posso_distribuir";

export interface AdvisorQueryAnswer {
  id: AdvisorQueryId;
  label: string;
  available: boolean;
  value: number | null;
  text: string;
}

function answer(
  id: AdvisorQueryId,
  label: string,
  value: number,
  text: string,
): AdvisorQueryAnswer {
  return { id, label, available: true, value, text };
}

function missing(id: AdvisorQueryId, label: string): AdvisorQueryAnswer {
  return { id, label, available: false, value: null, text: INSUFFICIENT_DATA_MESSAGE };
}

export const advisorQueries = {
  /** "Posso retirar R$ X?" */
  possoRetirar(advice: FinancialAdvice, amount: number): AdvisorQueryAnswer {
    if (!advice.available) return missing("posso_retirar", "Posso retirar");
    const reasons = advice.withdrawal.reasons.map((r) => `• ${r}`).join("\n");
    const head = advice.withdrawal.approved ? "Recomendado." : "Não recomendado.";
    return answer(
      "posso_retirar",
      "Posso retirar",
      advice.withdrawal.safeAmount,
      [
        `Solicitação: retirar ${formatCurrency(amount)}`,
        `Recomendação: ${head}`,
        "Motivos:",
        reasons,
        `Valor seguro hoje: ${formatCurrency(advice.withdrawal.safeAmount)}`,
        `Nível de risco: ${advice.risk.label}`,
      ].join("\n"),
    );
  },

  quantoPossoRetirar(advice: FinancialAdvice): AdvisorQueryAnswer {
    if (!advice.available) return missing("quanto_posso_retirar", "Retirada segura");
    return answer(
      "quanto_posso_retirar",
      "Retirada segura",
      advice.withdrawal.safeAmount,
      `Hoje você pode retirar com segurança ${formatCurrency(advice.withdrawal.safeAmount)} (risco ${advice.risk.label.toLowerCase()}).`,
    );
  },

  quantoManterDeReserva(advice: FinancialAdvice): AdvisorQueryAnswer {
    if (!advice.available) return missing("quanto_manter_reserva", "Reserva recomendada");
    return answer(
      "quanto_manter_reserva",
      "Reserva recomendada",
      advice.reserve.recommended,
      `Reserva recomendada: ${formatCurrency(advice.reserve.recommended)}. ${advice.reserve.rationale}`,
    );
  },

  quantoDisponivel(advice: FinancialAdvice): AdvisorQueryAnswer {
    if (!advice.available) return missing("quanto_disponivel", "Disponível");
    return answer(
      "quanto_disponivel",
      "Disponível",
      advice.availableCash,
      `Caixa disponível hoje: ${formatCurrency(advice.availableCash)}.`,
    );
  },

  quantoComprometido(advice: FinancialAdvice): AdvisorQueryAnswer {
    if (!advice.available) return missing("quanto_comprometido", "Comprometido");
    return answer(
      "quanto_comprometido",
      "Comprometido",
      advice.commitments.total,
      `Comprometido: ${formatCurrency(advice.commitments.total)} (a pagar ${formatCurrency(advice.commitments.payable)} + impostos ${formatCurrency(advice.commitments.taxes)}).`,
    );
  },

  quantoPrecisoPagar(advice: FinancialAdvice): AdvisorQueryAnswer {
    if (!advice.available) return missing("quanto_pagar", "Contas a pagar");
    return answer(
      "quanto_pagar",
      "Contas a pagar",
      advice.commitments.payable,
      `Contas a pagar em aberto: ${formatCurrency(advice.commitments.payable)}.`,
    );
  },

  quantoDevoReceber(
    advice: FinancialAdvice,
    cash: CashSnapshot | null | undefined,
  ): AdvisorQueryAnswer {
    if (!advice.available || !cash) return missing("quanto_receber", "Contas a receber");
    return answer(
      "quanto_receber",
      "Contas a receber",
      cash.receivable,
      `Contas a receber: ${formatCurrency(cash.receivable)} (vencidas ${formatCurrency(cash.receivableOverdue)}).`,
    );
  },

  reservaParaImpostos(advice: FinancialAdvice): AdvisorQueryAnswer {
    if (!advice.available) return missing("reserva_impostos", "Reserva de impostos");
    return answer(
      "reserva_impostos",
      "Reserva de impostos",
      advice.commitments.taxes,
      `Reserve ${formatCurrency(advice.commitments.taxes)} para os impostos apurados da competência.`,
    );
  },

  quantoDistribui(advice: FinancialAdvice): AdvisorQueryAnswer {
    if (!advice.available) return missing("quanto_distribui", "Já distribuído");
    // O ERP não tem infra para histórico oficial, então informamos 0 por enquanto conforme requisitos
    return answer(
      "quanto_distribui",
      "Já distribuído",
      0,
      "Não identifiquei distribuições de lucro registradas oficialmente neste período.",
    );
  },

  quantoPossoDistribuir(advice: FinancialAdvice): AdvisorQueryAnswer {
    if (!advice.available) return missing("quanto_posso_distribuir", "Ainda posso distribuir");
    return answer(
      "quanto_posso_distribuir",
      "Ainda posso distribuir",
      advice.withdrawal.safeAmount,
      `Você ainda pode distribuir até ${formatCurrency(advice.withdrawal.safeAmount)} com segurança.`,
    );
  },
};
