import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { salesService } from "../../services/sales.service";
import type { SaleDraftState } from "../../engine/types";
import { submitPdvSale } from "../lib/checkout";
import { createIdempotencyKeeper, saleFingerprint } from "../../lib/idempotency";

type Options = {
  companyId: string;
  cashSessionId: string | null;
  /** `number` é o número definitivo gerado pelo banco (VD-AAAAMMDD-0001). */
  onSuccess: (sale: { id: string; number?: string | null }) => void;
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
  // Auditoria 4.1 — chave anti-duplicata por venda (ver lib/idempotency.ts).
  const idempotencyRef = useRef(createIdempotencyKeeper());

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
            const clientRequestId = idempotencyRef.current.keyFor(
              saleFingerprint({
                customerId: state.customerId || null,
                paymentMethod: state.paymentMethod ?? null,
                discount: state.discount,
                shipping: state.shipping,
                items: state.items,
              }),
            );
            const created = await salesService.create(
              { ...payload, client_request_id: clientRequestId },
              { origin: "pdv" },
            );
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

        idempotencyRef.current.reset();
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
