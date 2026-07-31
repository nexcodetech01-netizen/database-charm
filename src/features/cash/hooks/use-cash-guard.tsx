import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { cashService } from "../services/cash.service";
import { OpenSessionDialog } from "../components/open-session-dialog";
import { RequireOpenCashDialog } from "../components/require-open-cash-dialog";

/**
 * UX-CAIXA-001 — Guarda de experiência para operações que exigem caixa aberto.
 *
 * NÃO altera regra de negócio: a validação continua sendo feita pelo motor
 * financeiro (`settle_financial_transaction`) e pelos serviços. Este hook
 * apenas intercepta o erro "não há caixa aberto", oferece a abertura do caixa
 * e, ao abrir com sucesso, reexecuta automaticamente a operação original.
 */
export function isCashClosedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return /CAIXA_FECHADO|caixa aberto|abrir o caixa/i.test(message);
}

interface Options {
  companyId: string;
  /** Nome da conta selecionada, apenas para exibição. */
  accountName?: string | null;
}

export function useCashGuard({ companyId, accountName }: Options) {
  const { user } = useAuth();
  const [promptOpen, setPromptOpen] = useState(false);
  const [openSessionOpen, setOpenSessionOpen] = useState(false);
  const pendingRef = useRef<null | (() => Promise<unknown>)>(null);

  const operatorName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Operador";

  /**
   * Executa a operação. Se falhar por caixa fechado, abre o fluxo de abertura
   * em vez de apenas exibir o erro. Qualquer outro erro é repassado.
   */
  const runWithCashGuard = useCallback(
    async <T,>(action: () => Promise<T>, opts?: { preCheck?: boolean }): Promise<T | undefined> => {
      // Verificação prévia (usada quando a operação não é idempotente):
      // evita executar metade do fluxo antes de o motor recusar.
      if (opts?.preCheck && user?.id) {
        const session = await cashService.getOpenSession(companyId, user.id);
        if (!session) {
          pendingRef.current = () => action();
          setPromptOpen(true);
          return undefined;
        }
      }
      try {
        return await action();
      } catch (err) {
        if (!isCashClosedError(err)) throw err;
        pendingRef.current = action as () => Promise<unknown>;
        setPromptOpen(true);
        return undefined;
      }
    },
    [companyId, user?.id],
  );

  /** Abre o fluxo de caixa manualmente e retoma `action` depois. */
  const requestOpenCash = useCallback((action: () => Promise<unknown> | void) => {
    pendingRef.current = async () => action();
    setPromptOpen(true);
  }, []);

  const cancel = useCallback(() => {
    pendingRef.current = null;
    setPromptOpen(false);
  }, []);

  const confirmOpenCash = useCallback(() => {
    setPromptOpen(false);
    setOpenSessionOpen(true);
  }, []);

  const retryPending = useCallback(async () => {
    const action = pendingRef.current;
    pendingRef.current = null;
    setOpenSessionOpen(false);
    if (!action) return;
    try {
      await action();
    } catch (err) {
      toast.error("Não foi possível concluir a operação", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }, []);

  const cashGuardDialog = (
    <>
      <RequireOpenCashDialog
        open={promptOpen}
        accountName={accountName}
        onCancel={cancel}
        onOpenCash={confirmOpenCash}
      />
      {user?.id ? (
        <OpenSessionDialog
          open={openSessionOpen}
          onOpenChange={setOpenSessionOpen}
          companyId={companyId}
          operatorId={user.id}
          operatorName={operatorName}
          onOpened={retryPending}
        />
      ) : null}
    </>
  );

  return { runWithCashGuard, requestOpenCash, cashGuardDialog };
}
