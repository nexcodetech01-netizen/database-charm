import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { storeCreditService, type ExchangeInput } from "../services/store-credit.service";

export const storeCreditKeys = {
  balance: (customerId: string) => ["store-credit", "balance", customerId] as const,
  entries: (customerId: string) => ["store-credit", "entries", customerId] as const,
};

export function useStoreCreditBalance(customerId: string | null | undefined) {
  return useQuery({
    queryKey: storeCreditKeys.balance(customerId ?? ""),
    queryFn: () => storeCreditService.balance(customerId as string),
    enabled: !!customerId,
    staleTime: 15_000,
  });
}

export function useStoreCreditEntries(customerId: string | null | undefined) {
  return useQuery({
    queryKey: storeCreditKeys.entries(customerId ?? ""),
    queryFn: () => storeCreditService.entries(customerId as string),
    enabled: !!customerId,
  });
}

export function useCreateExchange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ExchangeInput) => storeCreditService.exchange(input),
    onSuccess: (res, input) => {
      qc.invalidateQueries({ queryKey: ["returns", "sale", input.saleId] });
      qc.invalidateQueries({ queryKey: ["returns", "qty", input.saleId] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["store-credit"] });
      toast.success(`Troca registrada. Vale-troca de ${formatCurrency(res.credit)}.`, {
        description: `Saldo da cliente: ${formatCurrency(res.balance)}`,
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao registrar a troca."),
  });
}
