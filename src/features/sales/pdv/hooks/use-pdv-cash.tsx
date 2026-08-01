import { useCallback, useState } from "react";
import {
  OpenSessionDialog,
  RequireOpenCashDialog,
  useOpenCashSession,
} from "@/features/cash";
import { resolvePdvCashAccess, type PdvCashAccess } from "../lib/cash-access";
import { PDVCashMenu } from "../components/pdv-cash-menu";

type Options = {
  companyId: string;
  operatorId: string;
  operatorName: string;
  /** Nome exibido no relatório de fechamento (diálogo existente). */
  companyName?: string;
};

/**
 * PDV — Integração com o Caixa (Sprint 2.3).
 *
 * Reutiliza integralmente os hooks/componentes existentes:
 * `useOpenCashSession` (cashService), `RequireOpenCashDialog` e
 * `OpenSessionDialog`. Nenhuma regra de caixa é reimplementada aqui.
 */
export function usePdvCash({
  companyId,
  operatorId,
  operatorName,
  companyName = "NexOS",
}: Options): {
  access: PdvCashAccess;
  session: ReturnType<typeof useOpenCashSession>["data"];
  requestOpenCash: () => void;
  /** Abre o diálogo de fechamento existente (nunca fecha automaticamente). */
  requestCloseCash: () => void;
  closeCashOpen: boolean;
  cashMenu: React.ReactNode;
  cashDialogs: React.ReactNode;
} {
  const { data: session, isLoading } = useOpenCashSession(companyId, operatorId);
  const [promptOpen, setPromptOpen] = useState(false);
  const [openSessionOpen, setOpenSessionOpen] = useState(false);
  const [closeCashOpen, setCloseCashOpen] = useState(false);

  const access = resolvePdvCashAccess({ isLoading, session });

  const requestOpenCash = useCallback(() => setPromptOpen(true), []);
  const requestCloseCash = useCallback(() => {
    if (session) setCloseCashOpen(true);
  }, [session]);

  const cashMenu = (
    <PDVCashMenu
      companyId={companyId}
      companyName={companyName}
      operatorId={operatorId}
      session={session ?? null}
      closeOpen={closeCashOpen}
      onCloseOpenChange={setCloseCashOpen}
    />
  );

  const cashDialogs = (
    <>
      <RequireOpenCashDialog
        open={promptOpen}
        onCancel={() => setPromptOpen(false)}
        onOpenCash={() => {
          setPromptOpen(false);
          setOpenSessionOpen(true);
        }}
      />
      <OpenSessionDialog
        open={openSessionOpen}
        onOpenChange={setOpenSessionOpen}
        companyId={companyId}
        operatorId={operatorId}
        operatorName={operatorName}
      />
    </>
  );

  return {
    access,
    session,
    requestOpenCash,
    requestCloseCash,
    closeCashOpen,
    cashMenu,
    cashDialogs,
  };
}
