import { useQuery } from "@tanstack/react-query";
import { getCreditInstallmentByTransaction } from "../lib/credit-sync.functions";

/**
 * Hook para detectar se uma transação financeira está vinculada a um crediário.
 */
export function useCreditSync(transactionId?: string | null) {
  return useQuery({
    queryKey: ["finance", "credit-sync", transactionId],
    queryFn: () => transactionId ? getCreditInstallmentByTransaction({ data: { transactionId } }) : null,
    enabled: !!transactionId,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}
