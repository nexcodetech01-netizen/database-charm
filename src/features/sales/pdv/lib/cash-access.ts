import { isSessionStale, staleSessionMessage } from "@/features/cash";
import type { CashSession } from "@/features/cash";

/**
 * PDV — Regras de acesso ao caixa (Sprint 2.3).
 *
 * Função pura: NÃO cria fluxo novo de caixa. Apenas traduz a sessão já
 * retornada por `cashService`/`useOpenCashSession` no estado de UI do PDV,
 * usando exatamente as mesmas regras das demais telas (`isSessionStale`).
 */
export type PdvCashState = "loading" | "blocked" | "stale" | "ready";

export type PdvCashAccess = {
  state: PdvCashState;
  canOperate: boolean;
  message: string | null;
};

export function resolvePdvCashAccess(input: {
  isLoading: boolean;
  session: Pick<CashSession, "opened_at" | "status"> | null | undefined;
  now?: Date;
}): PdvCashAccess {
  if (input.isLoading) {
    return { state: "loading", canOperate: false, message: null };
  }

  const { session } = input;

  if (!session) {
    return {
      state: "blocked",
      canOperate: false,
      message: "Abra o caixa para iniciar as vendas no PDV.",
    };
  }

  if (isSessionStale(session, input.now ?? new Date())) {
    return {
      state: "stale",
      canOperate: false,
      message: staleSessionMessage(session as Pick<CashSession, "opened_at">),
    };
  }

  return { state: "ready", canOperate: true, message: null };
}
