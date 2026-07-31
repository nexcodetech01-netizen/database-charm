import { useCallback, useState } from "react";
import {
  OpenSessionDialog,
  RequireOpenCashDialog,
  useOpenCashSession,
} from "@/features/cash";
import { resolvePdvCashAccess, type PdvCashAccess } from "../lib/cash-access";

type Options = {
  companyId: string;
  operatorId: string;
  operatorName: string;
};

/**
 * PDV — Integração com o Caixa (Sprint 2.3).
 *
 * Reutiliza integralmente os hooks/componentes existentes:
 * `useOpenCashSession` (cashService), `RequireOpenCashDialog` e
 * `OpenSessionDialog`. Nenhuma regra de caixa é reimplementada aqui.
 */
export function usePdvCash({ companyId, operatorId, operatorName }: Options): {
  access: PdvCashAccess;
  session: ReturnType<typeof useOpenCashSession>["data"];
  requestOpenCash: () => void;
  cashDialogs: React.ReactNode;
} {
  const { data: session, isLoading } = useOpenCashSession(companyId, operatorId);
  const [promptOpen, setPromptOpen] = useState(false);
  const [openSessionOpen, setOpenSessionOpen] = useState(false);

  const access = resolvePdvCashAccess({ isLoading, session });

  const requestOpenCash = useCallback(() => setPromptOpen(true), []);

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

  return { access, session, requestOpenCash, cashDialogs };
}
