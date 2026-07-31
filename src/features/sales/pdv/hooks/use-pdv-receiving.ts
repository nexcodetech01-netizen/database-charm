import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { financeService } from "@/features/finance";
import type { FinancePaymentMethod } from "@/features/finance/types";
import { salesService } from "../../services/sales.service";
import { receivePdvSale } from "../lib/receiving";

type Options = {
  onReceived: (info: {
    paymentMethod: FinancePaymentMethod;
    saleId: string;
  }) => void;
};

/**
 * PDV — recebimento da venda (Sprint 2.5).
 *
 * Reutiliza integralmente os serviços existentes: `openReceivableForSale`
 * (RPC `ensure_sale_receivable`), `financeService.settleTransaction`
 * (RPC `settle_financial_transaction`, que registra caixa e saldo) e
 * `salesService.setStatus`. Nenhuma regra é duplicada aqui.
 */
export function usePdvReceiving({ onReceived }: Options) {
  const [isReceiving, setIsReceiving] = useState(false);
  const queryClient = useQueryClient();

  const receive = useCallback(
    async (input: {
      saleId: string;
      paymentMethod: FinancePaymentMethod | "";
      accountId: string;
    }) => {
      if (isReceiving) return;
      setIsReceiving(true);
      try {
        const result = await receivePdvSale(input, {
          openReceivable: (saleId) => salesService.openReceivableForSale(saleId),
          settle: (id, payload) => financeService.settleTransaction(id, payload),
          markPaid: (saleId) => salesService.setStatus(saleId, "paid"),
        });

        if (!result.ok) {
          // Venda permanece criada; o operador pode tentar novamente.
          toast.error("Não foi possível concluir o recebimento", {
            description: result.message,
          });
          return;
        }

        queryClient.invalidateQueries({ queryKey: ["sales"] });
        queryClient.invalidateQueries({ queryKey: ["finance"] });
        queryClient.invalidateQueries({ queryKey: ["cash"] });
        toast.success("Recebimento registrado com sucesso");
        onReceived({
          paymentMethod: input.paymentMethod as FinancePaymentMethod,
          saleId: input.saleId,
        });
      } finally {
        setIsReceiving(false);
      }
    },
    [isReceiving, onReceived, queryClient],
  );

  return { receive, isReceiving };
}
