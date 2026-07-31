import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { creditService, type CreateCreditSaleInput, type ReceiveCreditPaymentInput } from "../services/credit.service";

export const creditKeys = {
  all: ["credit"] as const,
  bySale: (saleId: string) => ["credit", "sale", saleId] as const,
  byCustomer: (customerId: string) => ["credit", "customer", customerId] as const,
};

export function useCreditDetailBySale(saleId: string, enabled = true) {
  return useQuery({
    queryKey: creditKeys.bySale(saleId),
    queryFn: () => creditService.getDetail(saleId),
    enabled: !!saleId && enabled,
  });
}

export function useCustomerCreditSummary(customerId: string) {
  return useQuery({
    queryKey: creditKeys.byCustomer(customerId),
    queryFn: () => creditService.getCustomerSummary(customerId),
    enabled: !!customerId,
  });
}

function invalidateAfterCreditChange(
  qc: ReturnType<typeof useQueryClient>,
  opts: { saleId?: string; customerId?: string | null },
) {
  qc.invalidateQueries({ queryKey: creditKeys.all });
  if (opts.saleId) {
    qc.invalidateQueries({ queryKey: ["sales", "detail", opts.saleId] });
    qc.invalidateQueries({ queryKey: ["sales", "list"] });
    qc.invalidateQueries({ queryKey: ["sales", "metrics"] });
  }
  if (opts.customerId) {
    qc.invalidateQueries({ queryKey: ["customers", "360", opts.customerId] });
    qc.invalidateQueries({ queryKey: ["customers", "detail", opts.customerId] });
  }
  qc.invalidateQueries({ queryKey: ["finance"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useCreateCreditSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCreditSaleInput) =>
      creditService.createCreditSale(input),
    onSuccess: (_data, vars) => {
      invalidateAfterCreditChange(qc, {
        saleId: vars.saleId,
        customerId: vars.customerId,
      });
    },
  });
}

export function useReceiveCreditPayment(
  meta: { saleId?: string; customerId?: string | null } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReceiveCreditPaymentInput) =>
      creditService.receivePayment(input),
    onSuccess: () => invalidateAfterCreditChange(qc, meta),
  });
}
