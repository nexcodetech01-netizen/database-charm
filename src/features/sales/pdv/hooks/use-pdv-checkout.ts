import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { salesService } from "../../services/sales.service";
import type { SaleDraftState } from "../../engine/types";
import { submitPdvSale } from "../lib/checkout";

type Options = {
  companyId: string;
  cashSessionId: string | null;
  onSuccess: (sale: { id: string }) => void;
};

/**
 * PDV — persistência da venda (Sprint 2.4).
 *
 * Reutiliza `salesService.create` (mesmo fluxo do formulário de vendas).
 * Nenhum pagamento, liquidação ou emissão fiscal acontece aqui.
 */
export function usePdvCheckout({ companyId, cashSessionId, onSuccess }: Options) {
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const finalize = useCallback(
    async (state: SaleDraftState) => {
      if (isSaving) return;
      setIsSaving(true);
      try {
        const result = await submitPdvSale({
          state,
          companyId,
          cashSessionId,
          // Origem explícita: habilita venda de consumidor final (sem cliente).
          create: async (payload) => {
            const created = await salesService.create(payload, { origin: "pdv" });
            if (!created) throw new Error("Falha ao criar a venda");
            return created;
          },
        });

        if (!result.ok) {
          // Carrinho preservado: nada é limpo no caminho de erro.
          toast.error("Não foi possível finalizar a venda", {
            description: result.message,
          });
          return;
        }

        queryClient.invalidateQueries({ queryKey: ["sales"] });
        toast.success("Venda registrada com sucesso");
        onSuccess(result.sale);
      } finally {
        setIsSaving(false);
      }
    },
    [companyId, cashSessionId, isSaving, onSuccess, queryClient],
  );

  return { finalize, isSaving };
}
