/**
 * PDV — emissão de NFC-e (Sprint 2.10).
 *
 * Reutiliza integralmente a infraestrutura fiscal existente:
 *  - `useFiscalSettings()` (configuração fiscal da empresa);
 *  - `issueFiscalFromSale` (motor único de emissão / SEFAZ / persistência).
 *
 * Nenhuma regra fiscal é duplicada e nenhuma venda é cancelada em caso de
 * falha: o resultado é apenas reportado ao operador.
 */
import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  fiscalKeys,
  issueFiscalFromSale,
  useFiscalSettings,
} from "@/features/fiscal/v2";
import {
  PDV_NFCE_FAILURE_MESSAGE,
  isPdvNfceEnabled,
  issuePdvNfce,
  type PdvFiscalOutcome,
} from "../lib/fiscal";

type Options = {
  onOutcome: (outcome: PdvFiscalOutcome) => void;
  onStart?: () => void;
};

export function usePdvFiscal({ onOutcome, onStart }: Options) {
  const settings = useFiscalSettings();
  const issueFn = useServerFn(issueFiscalFromSale);
  const queryClient = useQueryClient();
  const [isIssuing, setIsIssuing] = useState(false);

  const nfceEnabled = isPdvNfceEnabled(settings.data);

  const issue = useCallback(
    async (saleId: string): Promise<PdvFiscalOutcome> => {
      if (!nfceEnabled) {
        const outcome: PdvFiscalOutcome = { status: "disabled" };
        onOutcome(outcome);
        return outcome;
      }

      onStart?.();
      setIsIssuing(true);
      try {
        const outcome = await issuePdvNfce(
          { saleId, settings: settings.data },
          { issue: (args) => issueFn({ data: args }) },
        );

        if (outcome.status === "issued") {
          toast.success("NFC-e emitida com sucesso.");
        } else if (outcome.status === "failed") {
          toast.error(PDV_NFCE_FAILURE_MESSAGE, { description: outcome.message });
        }

        queryClient.invalidateQueries({ queryKey: fiscalKeys.all });
        onOutcome(outcome);
        return outcome;
      } finally {
        setIsIssuing(false);
      }
    },
    [issueFn, nfceEnabled, onOutcome, onStart, queryClient, settings.data],
  );

  return { issue, isIssuing, nfceEnabled };
}
