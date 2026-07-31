import { queryOptions, useQuery } from "@tanstack/react-query";
import type { AccountingPeriod, AccountingSummary } from "../types";
import { buildAccountingSummary } from "../providers/summary";
import { currentPeriod } from "../lib/helpers";

/**
 * Opções da consulta consolidada (Sprint 6.1.6 — P5).
 * `placeholderData` mantém o último resumo enquanto o novo carrega,
 * eliminando o skeleton piscando na troca de rota/período.
 */
export function accountingSummaryQueryOptions(
  companyId: string | undefined,
  period?: AccountingPeriod,
) {
  const resolved = period ?? currentPeriod();
  return queryOptions<AccountingSummary>({
    queryKey: ["accounting-ai", "summary", companyId, resolved.start, resolved.end],
    enabled: !!companyId,
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
    queryFn: () => buildAccountingSummary(companyId as string, { period: resolved }),
  });
}

/**
 * Leitura consolidada da Bella Contadora. Somente leitura, cacheada,
 * sem nenhuma mutação sobre módulos do ERP.
 */
export function useAccountingAiSummary(
  companyId: string | undefined,
  period?: AccountingPeriod,
) {
  return useQuery(accountingSummaryQueryOptions(companyId, period));
}
