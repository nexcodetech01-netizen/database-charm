/**
 * useCompanyFeeTable — tabela ÚNICA de taxas da empresa (FASE 4).
 * Nenhum componente pode mais declarar percentual hardcoded.
 */
import { useQuery } from "@tanstack/react-query";
import { paymentMethodsService } from "@/features/payment-methods/services/payment-methods.service";
import { buildFeeTable, EMPTY_FEE_TABLE, type CompanyFeeTable } from "../official/fees";

export function useCompanyFeeTable(companyId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["payment-method-fees", companyId],
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CompanyFeeTable> => {
      const rows = await paymentMethodsService.list(companyId as string);
      return buildFeeTable(rows);
    },
  });

  return {
    feeTable: query.data ?? EMPTY_FEE_TABLE,
    isLoading: query.isLoading,
    error: query.error,
  };
}
