import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { returnsService } from "../services/returns.service";
import { refundAsaasCharge } from "@/features/bella-pay/lib/bella-pay.functions";
import type { CreateReturnInput } from "../types";

export const returnsKeys = {
  bySale: (saleId: string) => ["returns", "sale", saleId] as const,
};

export function useSaleReturns(saleId: string) {
  return useQuery({
    queryKey: returnsKeys.bySale(saleId),
    queryFn: () => returnsService.listBySale(saleId),
    enabled: !!saleId,
  });
}

export function useReturnedQuantities(saleId: string) {
  return useQuery({
    queryKey: ["returns", "qty", saleId],
    queryFn: () => returnsService.returnedQuantitiesFor(saleId),
    enabled: !!saleId,
  });
}

export function useCreateReturn() {
  const qc = useQueryClient();
  const refundFn = useServerFn(refundAsaasCharge);
  return useMutation({
    mutationFn: async (input: CreateReturnInput) => {
      const ret = await returnsService.create(input);

      // If digital + linked Bella Pay charge, request refund
      if (
        ret.refund_status === "requested" &&
        ret.bella_pay_charge_id
      ) {
        try {
          const res = await refundFn({
            data: {
              chargeId: ret.bella_pay_charge_id,
              value: Number(ret.total_value),
              description: `Devolução ${ret.number}`,
            },
          });
          if (res.ok) {
            await returnsService.updateRefundStatus(
              ret.id,
              "requested",
              `Solicitação enviada (gateway: ${res.gatewayStatus}).`,
            );
          } else {
            await returnsService.updateRefundStatus(
              ret.id,
              "failed",
              res.message,
            );
          }
        } catch (err) {
          await returnsService.updateRefundStatus(
            ret.id,
            "failed",
            err instanceof Error ? err.message : "Falha no gateway.",
          );
        }
      }

      return ret;
    },
    onSuccess: (ret) => {
      qc.invalidateQueries({ queryKey: returnsKeys.bySale(ret.sale_id) });
      qc.invalidateQueries({ queryKey: ["returns", "qty", ret.sale_id] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
      qc.invalidateQueries({ queryKey: ["bella-pay"] });
      toast.success(`Devolução ${ret.number} registrada.`);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Erro ao registrar devolução."),
  });
}
