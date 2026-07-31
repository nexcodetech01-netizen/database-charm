import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { paymentMethodsService } from "../services/payment-methods.service";
import type { PaymentMethodFeeUpdate } from "../types";

export const paymentMethodsKeys = {
  all: ["payment-method-fees"] as const,
  byCompany: (companyId: string | null | undefined) =>
    ["payment-method-fees", companyId ?? "__none__"] as const,
};

export function usePaymentMethodFees(companyId: string | null | undefined) {
  return useQuery({
    queryKey: paymentMethodsKeys.byCompany(companyId),
    enabled: !!companyId,
    queryFn: () => paymentMethodsService.list(companyId!),
    staleTime: 5 * 60_000,
  });
}

export function useUpdatePaymentMethodFees(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patches: PaymentMethodFeeUpdate[]) =>
      paymentMethodsService.updateMany(patches),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: paymentMethodsKeys.byCompany(companyId) });
    },
  });
}
