import { useQuery } from "@tanstack/react-query";
import type { AccountingPeriod, AccountingSummary } from "../types";
import { buildAccountingSummary } from "../providers/summary";
import { currentPeriod } from "../lib/helpers";

/**
 * Leitura consolidada da Bella Contadora. Somente leitura, cacheada,
 * sem nenhuma mutação sobre módulos do ERP.
 */
export function useAccountingAiSummary(
  companyId: string | undefined,
  period?: AccountingPeriod,
) {
  const resolved = period ?? currentPeriod();
  return useQuery<AccountingSummary>({
    queryKey: ["accounting-ai", "summary", companyId, resolved.start, resolved.end],
    enabled: !!companyId,
    staleTime: 60_000,
    queryFn: () => buildAccountingSummary(companyId as string, { period: resolved }),
  });
}
